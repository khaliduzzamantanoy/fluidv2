import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isConnected = false;

const prisma = new PrismaClient();

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
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
}

export async function connectDatabase() {
  if (isConnected) return prisma;

  loadEnv();

  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await prisma.$connect();
      isConnected = true;
      console.log('[DB] PostgreSQL connected successfully');
      return prisma;
    } catch (err) {
      retryCount++;
      console.error(`[DB] Database connection attempt ${retryCount}/${maxRetries} failed:`, err.message);
      if (retryCount >= maxRetries) {
        console.error('[DB] Max retries reached. Starting without database...');
        console.error('[DB] Run `npm run setup:db` to install and configure PostgreSQL.');
        return null;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

export function getPrisma() {
  return prisma;
}

export function getConnectionStatus() {
  try {
    return {
      connected: isConnected,
      readyState: isConnected ? 'connected' : 'disconnected',
      provider: 'postgresql'
    };
  } catch {
    return { connected: false, readyState: 'disconnected', provider: 'postgresql' };
  }
}

export async function disconnectDatabase() {
  if (isConnected) {
    await prisma.$disconnect();
    isConnected = false;
    console.log('[DB] PostgreSQL disconnected');
  }
}

export default { connectDatabase, disconnectDatabase, getConnectionStatus, getPrisma };
