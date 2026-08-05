/**
 * @file src/backup/index.js
 * @description System entry point initializing backup connections and activating background scheduler.
 */

const mongoose = require('mongoose');
const { createBackupConnection } = require('./backup.connection');
const { startScheduler, stopScheduler } = require('./scheduler');
const logger = require('./logger');

// Ensure all Mongoose Schemas/Models are pre-registered
try {
  require('../models'); // Pre-load models (Adjust path if models folder is located elsewhere)
} catch (err) {
  // Safe failover if models index is not present
}

function startBackupWorker() {
  try {
    // Agar primary DB connection ready hai toh directly start karein, 
    // warna Mongoose ke 'connected' event ka wait karein.
    if (mongoose.connection.readyState === 1) {
      initBackupSystem();
    } else {
      mongoose.connection.once('connected', () => {
        initBackupSystem();
      });
    }

    // Graceful process shutdown handlers
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    logger.error('Failed to start backup worker system:', error);
  }
}

function initBackupSystem() {
  createBackupConnection();
  startScheduler();
}

function handleShutdown() {
  logger.info('Shutting down backup system gracefully...');
  stopScheduler();
}

module.exports = {
  startBackupWorker,
};