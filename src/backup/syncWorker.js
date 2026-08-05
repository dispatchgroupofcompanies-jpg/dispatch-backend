/**
 * @file src/backup/syncWorker.js
 * @description Dynamic Collection Sync Engine Entry point.
 */

const mongoose = require('mongoose');
const { getBackupConnection } = require('./backup.connection');
const { syncSingleCollection } = require('./syncCollection');
const logger = require('./logger');

async function runSyncWorker() {
  const startTime = Date.now();
  logger.info('Starting scheduled incremental sync cycle...');

  try {
    const backupConn = getBackupConnection();
    if (!backupConn || backupConn.readyState !== 1) {
      logger.error('Backup database connection is not active. Aborting sync cycle.');
      return;
    }

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      logger.error('Primary database connection is not active. Aborting sync cycle.');
      return;
    }

    // PRIMARY ATLAS DB SE DYNAMIC COLLECTIONS FETCH KAREIN
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.') && name !== 'backup_states');

    for (const collectionName of collectionNames) {
      await syncSingleCollection(collectionName, backupConn);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Completed incremental sync cycle in ${duration}s.`);
  } catch (error) {
    logger.error('Fatal error during backup sync cycle execution:', error);
  }
}

module.exports = { runSyncWorker };