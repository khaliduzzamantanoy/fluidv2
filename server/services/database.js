import { PrismaClient } from '@prisma/client';
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
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const prisma = new PrismaClient();

export async function connectDatabase() {
  if (isConnected) return prisma;

  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect();
      isConnected = true;
      console.log('[DB] SQLite connected');
      return prisma;
    } catch (err) {
      console.error(`[DB] Connection attempt ${i + 1}/${maxRetries} failed: ${err.message}`);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[DB] Max retries reached.');
  return null;
}

export function getPrisma() {
  return prisma;
}

export function getConnectionStatus() {
  return {
    connected: isConnected,
    readyState: isConnected ? 'connected' : 'disconnected',
    provider: 'sqlite'
  };
}

export async function disconnectDatabase() {
  if (isConnected) {
    await prisma.$disconnect();
    isConnected = false;
  }
}

export default { connectDatabase, disconnectDatabase, getConnectionStatus, getPrisma };
