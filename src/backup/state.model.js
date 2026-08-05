/**
 * @file src/backup/state.model.js
 * @description Mongoose schema for tracking collection sync metadata on Backup DB.
 */

const mongoose = require('mongoose');

const backupStateSchema = new mongoose.Schema(
  {
    collectionName: { type: String, required: true, unique: true, index: true },
    lastSync: { type: Date, default: new Date(0) },
    status: { type: String, enum: ['IDLE', 'SYNCING', 'SUCCESS', 'FAILED'], default: 'IDLE' },
    totalSynced: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

function getBackupStateModel(backupConn) {
  if (!backupConn) return null;
  return backupConn.models.backup_states || backupConn.model('backup_states', backupStateSchema, 'backup_states');
}

module.exports = { getBackupStateModel };