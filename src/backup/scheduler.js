/**
 * @file src/backup/scheduler.js
 * @description Manages interval scheduling and concurrent-execution locking.
 */

const logger = require('./logger');
const { runSyncWorker } = require('./syncWorker');

let isWorkerRunning = false;
let intervalId = null;

async function executeTask() {
  if (isWorkerRunning) {
    logger.warn('Previous backup sync is still in progress. Skipping duplicate execution cycle.');
    return;
  }

  isWorkerRunning = true;
  try {
    await runSyncWorker();
  } catch (error) {
    logger.error('Unexpected error during scheduled worker execution:', error);
  } finally {
    isWorkerRunning = false;
  }
}

function startScheduler() {
  if (intervalId) {
    logger.warn('Scheduler is already running.');
    return;
  }

  const minutes = parseInt(process.env.BACKUP_INTERVAL_MINUTES, 10) || 10;
  const intervalMs = minutes * 60 * 1000;

  // Initial delay of 5 seconds to let primary server startup complete
  setTimeout(() => {
    executeTask();
  }, 5000);

  intervalId = setInterval(() => {
    executeTask();
  }, intervalMs);

  logger.info(`Backup scheduler activated. Interval: every ${minutes} minutes.`);
}

function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Backup scheduler stopped.');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
};