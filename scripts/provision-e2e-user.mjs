#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`! ${message}`);
}

function readJwtRole(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role?.toString() ?? null;
  } catch {
    return null;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_TEST_EMAIL || process.env.E2E_EMAIL;
const password = process.env.E2E_TEST_PASSWORD || process.env.E2E_PASSWORD;

if (!url) fail('SUPABASE URL belum terisi.');
if (!serviceRoleKey) fail('SUPABASE_SERVICE_ROLE_KEY belum terisi.');
if (!email) fail('E2E_TEST_EMAIL belum terisi.');
if (!password) fail('E2E_TEST_PASSWORD belum terisi.');

const role = readJwtRole(serviceRoleKey);
if (role && role !== 'service_role') {
  fail(`SUPABASE_SERVICE_ROLE_KEY adalah role=${role}. Gunakan service_role key.`);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const listResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listResult.error) {
  fail(`Gagal list users: ${listResult.error.message}`);
}

const existing = listResult.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
let userId = existing?.id;

if (!existing) {
  const createResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'E2E Test User',
      role: 'umat',
    },
  });

  if (createResult.error || !createResult.data.user) {
    fail(`Gagal membuat user E2E: ${createResult.error?.message || 'unknown error'}`);
  }

  userId = createResult.data.user.id;
  pass('User E2E berhasil dibuat.');
} else {
  const updateResult = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });

  if (updateResult.error) {
    fail(`Gagal update user E2E: ${updateResult.error.message}`);
  }

  pass('User E2E ditemukan, password + email_confirm diperbarui.');
}

if (!userId) {
  fail('User ID E2E tidak ditemukan.');
}

const now = new Date().toISOString();
const profileResult = await admin.from('profiles').upsert(
  {
    id: userId,
    email,
    full_name: 'E2E Test User',
    role: 'umat',
    verification_status: 'unverified',
    account_status: 'unverified',
    faith_status: 'baptized',
    profile_filled: true,
    updated_at: now,
  },
  { onConflict: 'id' }
);

if (profileResult.error) {
  warn(`Profile upsert warning: ${profileResult.error.message}`);
} else {
  pass('Profile E2E sudah sinkron.');
}

console.log('\nSelesai. Jalankan: npm run audit:smoke');
