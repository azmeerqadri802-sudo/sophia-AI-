const mongoose = require('mongoose');

let isConnected = false;

async function connectDB(mongoUri) {
  if (isConnected) return true;
  if (!mongoUri) return false;
  try {
    const db = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500
    });
    isConnected = db.connections[0].readyState === 1;
    console.log('MongoDB Connected: Omnix Sophia CRM');
    return true;
  } catch (err) {
    console.log('Running in standalone desktop memory mode (MongoDB offline).');
    return false;
  }
}

module.exports = { connectDB, isDbConnected: () => isConnected };