const required = ["MONGO_URI", "JWT_SECRET"];

const assertProductionEnvironment = () => {
  if (process.env.NODE_ENV !== "production") return;

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }
};

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return process.env.JWT_SECRET;
};

module.exports = { assertProductionEnvironment, getJwtSecret };
