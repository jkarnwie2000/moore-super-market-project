const mongoose = require('mongoose');
const env = require('./env');

let memoryServer = null;
let connecting = null;

/**
 * Connects once and reuses the connection. In serverless environments (Vercel)
 * this function is called on every cold start, and warm invocations reuse it.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) return { inMemory: Boolean(memoryServer) };
  if (connecting) return connecting;

  connecting = (async () => {
    let uri = env.mongoUri;
    if (!uri) {
      if (env.isProduction || process.env.VERCEL) {
        throw new Error('MONGODB_URI is not set. Add a MongoDB Atlas connection string to the environment variables.');
      }
      // Development convenience: spin up a throwaway in-memory MongoDB.
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('moore-supermarket');
      console.warn('[db] MONGODB_URI not set — using an in-memory MongoDB (data resets on restart).');
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
    return { inMemory: Boolean(memoryServer) };
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null; // allow a retry on the next request
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  connecting = null;
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB };
