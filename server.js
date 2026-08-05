const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const { assertProductionEnvironment } = require("./src/config/env");
const { startBackupWorker, stopScheduler } = require("./src/backup");

const PORT = process.env.PORT || 5000;

const start = async () => {
  assertProductionEnvironment();
  await connectDB();

  // Initialize background backup worker (Runs in background without blocking API)
  startBackupWorker();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing server...`);
    stopScheduler(); // Gracefully stop backup scheduler on server shutdown

    server.close(async () => {
      const mongoose = require("mongoose");
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  console.error("Unable to start server:", error.message);
  process.exit(1);
});