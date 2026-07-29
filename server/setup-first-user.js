#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
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

async function main() {
  console.log('\n==================================================');
  console.log('  FLUID VPS PORTAL - FIRST USER SETUP');
  console.log('==================================================\n');

  loadEnv();

  console.log('Create your admin account for the Fluid VPS Portal:\n');

  let username = '';
  while (!username || username.length < 3) {
    username = await ask('  Username (min 3 chars): ');
    if (username.length < 3) console.log('  Username must be at least 3 characters.\n');
  }

  let password = '';
  while (!password || password.length < 8) {
    password = await ask('  Password (min 8 chars): ');
    if (password.length < 8) console.log('  Password must be at least 8 characters.\n');
  }

  let passwordConfirm = '';
  while (passwordConfirm !== password) {
    passwordConfirm = await ask('  Confirm Password: ');
    if (passwordConfirm !== password) console.log('  Passwords do not match.\n');
  }

  let email = await ask('  Email (optional): ');

  rl.close();

  const databaseUrl = process.env.DATABASE_URL || 'postgresql://fluid:fluid@127.0.0.1:5432/fluid';
  console.log('\n[1/2] Connecting to PostgreSQL...');

  try {
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    console.log('[OK] Connected to PostgreSQL\n');

    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      console.log('[INFO] Admin user already exists. Creating additional user.\n');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      console.error(`[ERROR] Username '${username}' is already taken.\n`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email?.toLowerCase() || null,
        passwordHash,
        fullName: username,
        role: 'owner'
      }
    });

    console.log(`[OK] Admin user '${username}' created successfully!\n`);

    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      const now = new Date().toISOString();
      if (!envContent.includes('ADMIN_USERNAME=')) {
        envContent += `\nADMIN_USERNAME=${username}`;
      }
      if (!envContent.includes('ADMIN_CREATED_AT=')) {
        envContent += `\nADMIN_CREATED_AT=${now}`;
      }
      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('[OK] Credentials saved to .env\n');
    }

    const credsPath = '/root/fluid-credentials.txt';
    if (fs.existsSync(credsPath)) {
      try { fs.rmSync(credsPath, { force: true }); } catch (e) {}
      console.log('[OK] Temporary credentials file removed\n');
    }

    await prisma.$disconnect();

    console.log('==================================================');
    console.log('  SETUP COMPLETE!');
    console.log('==================================================');
    console.log('\n  You can now login to the Fluid VPS Portal at:');
    console.log('  http://your-vps-ip:6776\n');
    console.log(`  Username: ${username}`);
    console.log('  Password: (the one you just set)\n');

  } catch (err) {
    console.error(`[ERROR] Failed to create user: ${err.message}\n`);
    process.exit(1);
  }
}

main();
