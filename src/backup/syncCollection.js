
const mongoose = require('mongoose');
const logger = require('./logger');
const { getBackupStateModel } = require('./state.model');
const { syncDeletions } = require('./deleteSync');
const { chunkArray, retry } = require('./utils');

async function syncSingleCollection(collectionName, backupConn) {
  const startTime = Date.now();
  const stats = { newDocs: 0, updatedDocs: 0, deletedDocs: 0, skippedDocs: 0, failedDocs: 0 };

  const BackupState = getBackupStateModel(backupConn);
  if (!BackupState) return stats;

  try {
    const stateDoc = await BackupState.findOne({ collectionName });

    const primaryColl = mongoose.connection.db.collection(collectionName);
    const backupColl = backupConn.collection(collectionName);

    // Agar local backup collection khali hai, toh force Full Initial Sync karein
    const backupDocsCount = await backupColl.countDocuments();
    const isFirstSync = backupDocsCount === 0;

    const lastSync = (stateDoc && stateDoc.lastSync && !isFirstSync)
      ? stateDoc.lastSync
      : new Date(0);

    await BackupState.updateOne(
      { collectionName },
      { $set: { status: 'SYNCING' } },
      { upsert: true }
    );

    // Initial sync par saare docs query honge, uske baad sirf changed docs
    const query = isFirstSync
      ? {}
      : {
          $or: [
            { updatedAt: { $gt: lastSync } },
            { createdAt: { $gt: lastSync } },
            { _id: { $gt: lastSync } },
          ],
        };

    const modifiedDocs = await primaryColl.find(query).toArray();

    if (modifiedDocs.length > 0) {
      const docChunks = chunkArray(modifiedDocs, 500);

      for (const chunk of docChunks) {
        const chunkIds = chunk.map((doc) => doc._id);
        const existingInBackup = await backupColl
          .find({ _id: { $in: chunkIds } }, { projection: { _id: 1 } })
          .toArray();

        const existingSet = new Set(existingInBackup.map((d) => d._id.toString()));

        const bulkOps = chunk.map((doc) => {
          if (existingSet.has(doc._id.toString())) {
            stats.updatedDocs++;
          } else {
            stats.newDocs++;
          }
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: doc },
              upsert: true,
            },
          };
        });

        await retry(async () => {
          await backupColl.bulkWrite(bulkOps, { ordered: false });
        }, 3, 1000);
      }
    }

    stats.deletedDocs = await syncDeletions(collectionName, backupConn);

    const executionEndTime = new Date();
    const totalSyncedCount = stats.newDocs + stats.updatedDocs;

    await BackupState.updateOne(
      { collectionName },
      {
        $set: {
          lastSync: executionEndTime,
          status: 'SUCCESS',
          lastError: null,
        },
        $inc: { totalSynced: totalSyncedCount },
      },
      { upsert: true }
    );
  } catch (error) {
    stats.failedDocs++;
    logger.error(`Error syncing collection ${collectionName}:`, error);

    await BackupState.updateOne(
      { collectionName },
      {
        $set: {
          status: 'FAILED',
          lastError: error.message,
        },
      },
      { upsert: true }
    );
  } finally {
    const durationMs = Date.now() - startTime;
    logger.logCollectionSummary(collectionName, stats, durationMs);
  }

  return stats;
}

module.exports = { syncSingleCollection };