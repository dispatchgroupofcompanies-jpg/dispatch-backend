/**
 * @file src/backup/deleteSync.js
 * @description Synchronizes hard/soft deleted documents from Primary DB to Backup DB.
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const { chunkArray } = require('./utils');

async function syncDeletions(collectionName, backupConn) {
  let deletedCount = 0;
  try {
    const primaryColl = mongoose.connection.collection(collectionName);
    const backupColl = backupConn.collection(collectionName);

    // Fetch all IDs present in backup
    const backupIds = await backupColl.find({}, { projection: { _id: 1 } }).toArray();
    if (backupIds.length === 0) return 0;

    const backupIdList = backupIds.map((doc) => doc._id);
    const chunks = chunkArray(backupIdList, 1000);

    for (const chunk of chunks) {
      // Find IDs that exist in Backup but no longer exist in Primary
      const existingInPrimary = await primaryColl
        .find({ _id: { $in: chunk } }, { projection: { _id: 1 } })
        .toArray();

      const primaryIdSet = new Set(existingInPrimary.map((doc) => doc._id.toString()));
      const idsToDelete = chunk.filter((id) => !primaryIdSet.has(id.toString()));

      if (idsToDelete.length > 0) {
        const deleteRes = await backupColl.deleteMany({ _id: { $in: idsToDelete } });
        deletedCount += deleteRes.deletedCount || 0;
      }
    }
  } catch (error) {
    logger.error(`Deletion sync failed for ${collectionName}:`, error);
  }
  return deletedCount;
}

module.exports = { syncDeletions };