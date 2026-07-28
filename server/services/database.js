import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isConnected = false;

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

export async function connectDatabase() {
  if (isConnected) return;

  loadEnv();

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fluid';
  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000
      });
      isConnected = true;
      console.log('[DB] MongoDB connected successfully');
      return;
    } catch (err) {
      retryCount++;
      console.error(`[DB] MongoDB connection attempt ${retryCount}/${maxRetries} failed:`, err.message);
      if (retryCount >= maxRetries) {
        console.error('[DB] Max retries reached. Starting without database...');
        console.error('[DB] Run `npm run setup:db` to install and configure MongoDB.');
        return;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

export function getConnectionStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}

export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[DB] MongoDB disconnected');
  }
}

export default { connectDatabase, disconnectDatabase, getConnectionStatus };