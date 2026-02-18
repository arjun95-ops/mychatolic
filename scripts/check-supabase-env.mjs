#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

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

function get(key) {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function hasValue(key) {
  return get(key).length > 0;
}

function masked(value) {
  if (!value) return '(empty)';
  if (value.length <= 10) return `${value[0]}***${value[value.length - 1]}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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

function printCheck(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${icon} ${label}${suffix}`);
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const anonKey = get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || get('SUPABASE_ANON_KEY');
const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');
const e2eEmail = get('E2E_TEST_EMAIL') || get('E2E_EMAIL');
const e2ePassword = get('E2E_TEST_PASSWORD') || get('E2E_PASSWORD');

const serviceRoleClaim = readJwtRole(serviceKey);
const anonRoleClaim = readJwtRole(anonKey);

console.log('Supabase Env Check\n');

printCheck(
  'Supabase URL',
  Boolean(url),
  url ? `${url.startsWith('https://') ? 'https' : 'invalid'} | ${masked(url)}` : 'missing'
);
printCheck(
  'Anon key',
  Boolean(anonKey),
  anonKey ? `len=${anonKey.length} | role=${anonRoleClaim || 'non-jwt'} | ${masked(anonKey)}` : 'missing'
);

const serviceKeyIsPlaceholder =
  serviceKey.toUpperCase().includes('YOUR_') || serviceKey === 'YOUR_SERVICE_ROLE_KEY';

if (!serviceKey) {
  printCheck('Service role key', false, 'missing');
} else if (serviceKeyIsPlaceholder) {
  printCheck('Service role key', false, 'still placeholder');
} else if (serviceRoleClaim && serviceRoleClaim !== 'service_role') {
  printCheck('Service role key', false, `JWT role=${serviceRoleClaim} (expected service_role)`);
} else if (serviceRoleClaim === 'service_role') {
  printCheck('Service role key', true, `JWT role=service_role | ${masked(serviceKey)}`);
} else {
  printCheck('Service role key', true, `non-jwt key format detected | ${masked(serviceKey)}`);
}

printCheck(
  'E2E test email',
  Boolean(e2eEmail),
  e2eEmail ? masked(e2eEmail) : 'missing'
);
printCheck(
  'E2E test password',
  Boolean(e2ePassword),
  e2ePassword ? `len=${e2ePassword.length}` : 'missing'
);

console.log('\nRecommendation:');
if (!url || !anonKey) {
  console.log('- Isi URL + anon key dulu, lalu jalankan: npm run verify:sync');
} else if (!serviceKey || serviceKeyIsPlaceholder || (serviceRoleClaim && serviceRoleClaim !== 'service_role')) {
  console.log('- Ganti SUPABASE_SERVICE_ROLE_KEY dengan key service role yang benar dari Supabase Dashboard.');
  console.log('- Setelah update: npm run verify:sync');
} else if (!e2eEmail || !e2ePassword) {
  console.log('- Isi E2E_TEST_EMAIL + E2E_TEST_PASSWORD untuk auth smoke.');
  console.log('- Setelah update: npm run audit:smoke');
} else {
  console.log('- Env sudah siap untuk audit penuh.');
  console.log('- Jalankan: npm run verify:sync && npm run audit:smoke');
}
