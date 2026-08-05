/**
 * @file src/backup/logger.js
 * @description Structured production logging helper.
 */

const { formatDuration } = require('./utils');

const logger = {
  info: (msg, meta = {}) => {
    console.log(`[BACKUP INFO] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  error: (msg, error = {}) => {
    console.error(`[BACKUP ERROR] [${new Date().toISOString()}] ${msg}`, error.stack || error.message || error);
  },
  warn: (msg, meta = {}) => {
    console.warn(`[BACKUP WARN] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  logCollectionSummary: (collectionName, stats, durationMs) => {
    console.log(
      `[BACKUP METRICS] Collection: ${collectionName} | New: ${stats.newDocs} | Updated: ${stats.updatedDocs} | Deleted: ${stats.deletedDocs} | Skipped: ${stats.skippedDocs} | Errors: ${stats.failedDocs} | Duration: ${formatDuration(durationMs)}`
    );
  }
};

module.exports = logger;