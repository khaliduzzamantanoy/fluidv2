#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, stdio: 'pipe' });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function generateSecurePassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function main() {
  log('bold', '\n==================================================');
  log('bold', '  FLUID VPS PORTAL - SETUP');
  log('bold', '==================================================\n');

  const envPath = path.join(__dirname, '../.env');
  const dbPath = path.join(__dirname, '../fluid.db');
  const dbUrl = `file:${dbPath}`;

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  log('cyan', '[1/4] Configuring environment...');
  const jwtSecret = generateSecurePassword(64);
  const encryptionKey = generateSecurePassword(32);
  const cookieSecret = generateSecurePassword(32);

  const updates = {
    DATABASE_URL: dbUrl,
    JWT_SECRET: jwtSecret,
    ENCRYPTION_KEY: encryptionKey,
    COOKIE_SECRET: cookieSecret
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  log('green', '  Environment configured');

  log('cyan', '[2/4] Creating database...');
  try {
    const rootDir = path.join(__dirname, '..');
    const env = { ...process.env, DATABASE_URL: dbUrl };
    await runCommand('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
      cwd: rootDir,
      env,
      stdio: 'pipe'
    });
    log('green', '  Database created');
  } catch (err) {
    log('yellow', `  [WARN] ${err.message}`);
  }

  log('cyan', '[3/4] Creating admin user...');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();

    const existing = await prisma.user.count();
    if (existing === 0) {
      const bcrypt = (await import('bcryptjs')).default;
      const hashed = bcrypt.hashSync('hellofluid', 12);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash: hashed,
          fullName: 'Administrator',
          role: 'owner',
          mustChangePassword: true
        }
      });
      log('green', '  Admin user created');
    } else {
      log('yellow', '  Admin user already exists, skipping');
    }

    await prisma.$disconnect();
  } catch (err) {
    log('yellow', `  [WARN] Could not create admin user: ${err.message}`);
  }

  log('cyan', '[4/4] Generating Prisma client...');
  try {
    await runCommand('npx', ['prisma', 'generate'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'pipe'
    });
    log('green', '  Prisma client generated');
  } catch (err) {
    log('yellow', `  [WARN] ${err.message}`);
  }

  log('bold', '\n==================================================');
  log('green', '  SETUP COMPLETE!');
  log('bold', '==================================================\n');
  log('cyan', '  Login credentials:');
  log('bold', '  Username: admin');
  log('bold', '  Password: hellofluid');
  log('yellow', '  ⚠ You will be prompted to change this password on first login.\n');
  log('cyan', '  Open http://<YOUR_VPS_IP>:6776 to continue.\n');

  console.log('FLUID_ADMIN_PASSWORD=hellofluid');
}

main();
