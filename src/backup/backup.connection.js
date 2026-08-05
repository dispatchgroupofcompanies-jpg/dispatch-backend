/**
 * @file src/backup/backup.connection.js
 * @description Primary MongoDB connection ko bina chhode, Backup MongoDB Atlas ke liye
 * alag Mongoose connection manage aur maintain karta hai.
 */

const mongoose = require('mongoose');

let backupConnection = null;

/**
 * Backup Database ke liye ek alag connection establish karta hai.
 * Auto-reconnect handle karta hai aur server ko crash hone se bachata hai.
 * 
 * @returns {mongoose.Connection|null} Backup DB ka Mongoose connection instance
 */
function createBackupConnection() {
  const backupUri = process.env.BACKUP_MONGO_URI;

  if (!backupUri) {
    console.error('[Backup DB Error] BACKUP_MONGO_URI environment variable mein set nahi hai.');
    return null;
  }

  // Agar connection pehle se active ya connecting state mein hai toh wahi return karein
  if (backupConnection && (backupConnection.readyState === 1 || backupConnection.readyState === 2)) {
    return backupConnection;
  }

  try {
    // Main mongoose connection ko bina disturb kiye ek naya connection create karein
    backupConnection = mongoose.createConnection(backupUri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    backupConnection.on('connected', () => {
      console.log('[Backup DB] Successfully connected to Backup MongoDB Atlas.');
    });

    backupConnection.on('error', (err) => {
      console.error('[Backup DB Error] Connection error:', err.message);
    });

    backupConnection.on('disconnected', () => {
      console.warn('[Backup DB Warning] Backup DB disconnect ho gaya hai. Driver auto-reconnect try karega.');
    });

    backupConnection.on('reconnected', () => {
      console.log('[Backup DB] Reconnected to Backup MongoDB Atlas.');
    });

    return backupConnection;
  } catch (error) {
    console.error('[Backup DB Error] Connection initialization failed:', error.message);
    return null;
  }
}

/**
 * Current active backup connection return karta hai.
 * Agar disconnected ho toh naya connection start karta hai.
 * 
 * @returns {mongoose.Connection|null}
 */
function getBackupConnection() {
  if (!backupConnection || backupConnection.readyState === 0) {
    return createBackupConnection();
  }
  return backupConnection;
}

module.exports = {
  createBackupConnection,
  getBackupConnection,
};