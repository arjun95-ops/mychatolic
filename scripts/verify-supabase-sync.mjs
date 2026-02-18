#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
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
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return payload.role?.toString() ?? null;
  } catch {
    return null;
  }
}

function isPlaceholderValue(value) {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized === 'YOUR_SERVICE_ROLE_KEY' || normalized.includes('YOUR_');
}

function describeServiceKey(value) {
  if (!value) {
    return { kind: 'missing', role: null };
  }

  if (isPlaceholderValue(value)) {
    return { kind: 'placeholder', role: null };
  }

  const role = readJwtRole(value);
  if (role === 'service_role') {
    return { kind: 'jwt_service_role', role };
  }
  if (role && role !== 'service_role') {
    return { kind: 'jwt_non_service_role', role };
  }

  // Supabase modern secret keys may not be JWT (`sb_secret_...`).
  return { kind: 'non_jwt', role: null };
}

function isPermissionError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('not authenticated')
  );
}

function isInvalidApiKeyError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('apikey is invalid') ||
    lower.includes('invalid jwt') ||
    lower.includes('jwt malformed') ||
    lower.includes('no api key found')
  );
}

function isMissingSchemaError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find') ||
    lower.includes('42703') ||
    lower.includes('42p01') ||
    lower.includes('pgrst200') ||
    lower.includes('pgrst205')
  );
}

function createSupabaseClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runSimpleChecks(client, contextLabel, checks) {
  for (const check of checks) {
    const { error } = await check.run(client);
    if (!error) {
      pass(check.name);
      continue;
    }

    const message = `${error.message} ${error.details || ''}`;
    if (isPermissionError(message)) {
      warn(`${check.name}: akses dibatasi RLS (${contextLabel})`);
      continue;
    }

    fail(`${check.name}: ${error.message}`);
  }
}

async function runSchemaContractCheck(client, contextLabel, definition) {
  for (const attempt of definition.attempts) {
    const { error } = await attempt.run(client);

    if (!error) {
      pass(definition.name);
      if (attempt.note) {
        warn(`${definition.name}: ${attempt.note}`);
      }
      return;
    }

    const message = `${error.message} ${error.details || ''}`;
    if (isPermissionError(message)) {
      warn(`${definition.name}: akses dibatasi RLS (${contextLabel})`);
      return;
    }

    if (isMissingSchemaError(message)) {
      continue;
    }

    fail(`${definition.name}: ${error.message}`);
    return;
  }

  fail(`${definition.name}: tidak ada varian schema yang cocok`);
}

async function runRpcChecks(client, contextLabel, checks) {
  for (const check of checks) {
    const { error } = await check.run(client);
    if (!error) {
      pass(check.name);
      if (check.warnIfSuccess) {
        warn(`${check.name}: ${check.warnIfSuccess}`);
      }
      continue;
    }

    const message = `${error.message} ${error.details || ''}`;
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes('could not find the function') ||
      (lowerMessage.includes('function') && lowerMessage.includes('does not exist'))
    ) {
      if (check.optionalMissing) {
        warn(`${check.name}: function belum tersedia (${error.message})`);
        continue;
      }
      fail(`${check.name}: function tidak ditemukan`);
      continue;
    }

    if (
      lowerMessage.includes('not a member of this chat') ||
      lowerMessage.includes('chat tidak ditemukan')
    ) {
      warn(`${check.name}: function ada, tetapi butuh konteks chat valid (${error.message})`);
      continue;
    }

    if (isPermissionError(message)) {
      warn(`${check.name}: function ada, tapi eksekusi dibatasi (${contextLabel}: ${error.message})`);
      continue;
    }

    fail(`${check.name}: ${error.message}`);
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  fail(
    'Environment variable belum lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY sudah di-set.'
  );
  process.exit(1);
}

const runtimeClient = createSupabaseClient(url, anonKey);
const serviceKeyInfo = describeServiceKey(serviceKey);
let adminClient = null;

if (serviceKeyInfo.kind === 'missing') {
  warn('SUPABASE_SERVICE_ROLE_KEY belum diisi. Admin-key checks dilewati.');
} else if (serviceKeyInfo.kind === 'placeholder') {
  warn('SUPABASE_SERVICE_ROLE_KEY masih placeholder. Admin-key checks dilewati.');
} else if (serviceKeyInfo.kind === 'jwt_non_service_role') {
  warn(
    `SUPABASE_SERVICE_ROLE_KEY terdeteksi tapi rolenya bukan service_role (${serviceKeyInfo.role || 'unknown'}). Admin-key checks dilewati.`
  );
} else {
  adminClient = createSupabaseClient(url, serviceKey);
  const listUsersProbe = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listUsersProbe.error) {
    const message = `${listUsersProbe.error.message} ${listUsersProbe.error.status || ''}`;
    if (isInvalidApiKeyError(message)) {
      warn(`SUPABASE_SERVICE_ROLE_KEY tidak valid (${listUsersProbe.error.message}). Admin-key checks dilewati.`);
      adminClient = null;
    } else {
      warn(
        `SUPABASE_SERVICE_ROLE_KEY terdeteksi, tapi admin auth probe gagal (${listUsersProbe.error.message}). Admin-key checks dilewati.`
      );
      adminClient = null;
    }
  } else {
    pass('admin key probe (auth.admin.listUsers)');
  }
}

const simpleChecks = [
  {
    name: 'profiles columns (account_status, faith_status)',
    run: (client) =>
      client
        .from('profiles')
        .select('id, verification_status, account_status, faith_status')
        .limit(1),
  },
  {
    name: 'saved_posts table',
    run: (client) => client.from('saved_posts').select('id, user_id, post_id, created_at').limit(1),
  },
  {
    name: 'social_chats group/invite columns',
    run: (client) =>
      client
        .from('social_chats')
        .select(
          'id, is_group, group_name, group_avatar_url, admin_id, creator_id, invite_mode, invite_code, invite_link_enabled, allow_member_invite'
        )
        .limit(1),
  },
  {
    name: 'chat_members inbox columns',
    run: (client) =>
      client
        .from('chat_members')
        .select(
          'chat_id, user_id, role, status, joined_at, unread_count, pinned_at, archived_at, muted_until, last_read_at'
        )
        .limit(1),
  },
  {
    name: 'social_messages advanced columns',
    run: (client) =>
      client
        .from('social_messages')
        .select(
          'id, chat_id, sender_id, message_type, media_url, file_name, file_size, reply_to_id, is_read, read_at, reactions'
        )
        .limit(1),
  },
  {
    name: 'countries table (register master data)',
    run: (client) => client.from('countries').select('id, name').limit(1),
  },
  {
    name: 'dioceses table (register master data)',
    run: (client) => client.from('dioceses').select('id, country_id, name').limit(1),
  },
];

await runSimpleChecks(runtimeClient, 'runtime anon/publishable key', simpleChecks);

if (adminClient) {
  await runSimpleChecks(adminClient, 'admin key', [
    {
      name: 'admin key can read profiles baseline',
      run: (client) => client.from('profiles').select('id').limit(1),
    },
  ]);
}

const schemaContractChecks = [
  {
    name: 'notifications contract (is_read / read_at)',
    attempts: [
      {
        run: (client) =>
          client
            .from('notifications')
            .select('id, user_id, type, title, message, is_read, created_at')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('notifications')
            .select('id, user_id, type, title, message, read_at, created_at')
            .limit(1),
        note: 'fallback menggunakan kolom read_at (tanpa is_read)',
      },
      {
        run: (client) => client.from('notifications').select('*').limit(1),
        note: 'fallback minimal: validasi tabel notifications tanpa kontrak kolom spesifik',
      },
    ],
  },
  {
    name: 'churches table',
    attempts: [
      {
        run: (client) => client.from('churches').select('id, name, diocese_id').limit(1),
      },
    ],
  },
  {
    name: 'stories contract',
    attempts: [
      {
        run: (client) =>
          client
            .from('stories')
            .select('id, user_id, media_url, media_type, caption, audience, created_at, expires_at')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('stories')
            .select('id, user_id, media_url, media_type, caption, created_at, expires_at')
            .limit(1),
        note: 'fallback tanpa kolom audience',
      },
      {
        run: (client) => client.from('stories').select('*').limit(1),
        note: 'fallback minimal: validasi tabel stories tanpa kontrak kolom spesifik',
      },
    ],
  },
  {
    name: 'story interaction contract',
    attempts: [
      {
        run: (client) =>
          client
            .from('story_views')
            .select('story_id, viewer_id, viewed_at')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('story_views')
            .select('story_id, user_id, viewed_at')
            .limit(1),
        note: 'fallback story_views menggunakan user_id',
      },
      {
        run: (client) => client.from('story_reactions').select('story_id, user_id, reaction').limit(1),
        note: 'fallback validasi story_reactions',
      },
      {
        run: (client) => client.from('story_replies').select('story_id, sender_id, content').limit(1),
        note: 'fallback validasi story_replies',
      },
    ],
  },
  {
    name: 'mass_schedules contract',
    attempts: [
      {
        run: (client) =>
          client
            .from('mass_schedules')
            .select('id, church_id, day_of_week, start_time, language')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('mass_schedules')
            .select('id, church_id, day_number, start_time, language')
            .limit(1),
        note: 'fallback menggunakan day_number + start_time',
      },
      {
        run: (client) =>
          client
            .from('mass_schedules')
            .select('id, church_id, mass_time, language')
            .limit(1),
        note: 'fallback menggunakan mass_time',
      },
      {
        run: (client) => client.from('mass_schedules').select('*').limit(1),
        note: 'fallback minimal: validasi tabel mass_schedules tanpa kontrak kolom spesifik',
      },
    ],
  },
  {
    name: 'radar events table (v1/v2)',
    attempts: [
      {
        run: (client) =>
          client
            .from('radar_events')
            .select('id, title, event_starts_at_utc, max_participants, church_id')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('radar_events_v2')
            .select('id, title, event_starts_at_utc, max_participants, church_id')
            .limit(1),
        note: 'fallback menggunakan radar_events_v2',
      },
    ],
  },
  {
    name: 'radar participants table (v1/v2)',
    attempts: [
      {
        run: (client) => client.from('radar_participants').select('radar_id').limit(1),
      },
      {
        run: (client) => client.from('radar_participants_v2').select('radar_id').limit(1),
        note: 'fallback menggunakan radar_participants_v2',
      },
    ],
  },
  {
    name: 'radar_invites contract',
    attempts: [
      {
        run: (client) =>
          client
            .from('radar_invites')
            .select('id, inviter_id, invitee_id, radar_id, source, status, note, expires_at, responded_at, created_at')
            .limit(1),
      },
      {
        run: (client) => client.from('radar_invites').select('*').limit(1),
        note: 'fallback minimal: validasi tabel radar_invites tanpa kontrak kolom spesifik',
      },
    ],
  },
  {
    name: 'mass checkins table (v1/v2)',
    attempts: [
      {
        run: (client) =>
          client
            .from('mass_checkins')
            .select('id, user_id, church_id, checkin_at')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('mass_checkins')
            .select('id, user_id, church_id, check_in_time')
            .limit(1),
        note: 'fallback v1 menggunakan check_in_time',
      },
      {
        run: (client) =>
          client
            .from('mass_checkins_v2')
            .select('id, user_id, church_id, checkin_at')
            .limit(1),
        note: 'fallback menggunakan mass_checkins_v2',
      },
    ],
  },
  {
    name: 'bible_books contract',
    attempts: [
      {
        run: (client) =>
          client
            .from('bible_books')
            .select('id, name, testament, book_order')
            .limit(1),
      },
      {
        run: (client) =>
          client
            .from('bible_books')
            .select('id, book_name, testament, order_no')
            .limit(1),
        note: 'fallback menggunakan book_name + order_no',
      },
      {
        run: (client) =>
          client
            .from('bible_books')
            .select('id, name, grouping, order_index')
            .limit(1),
        note: 'fallback menggunakan grouping + order_index',
      },
      {
        run: (client) => client.from('bible_books').select('*').limit(1),
        note: 'fallback minimal: validasi tabel bible_books tanpa kontrak kolom spesifik',
      },
    ],
  },
];

for (const check of schemaContractChecks) {
  await runSchemaContractCheck(runtimeClient, 'runtime anon/publishable key', check);
}

const rpcChecks = [
  {
    name: 'RPC update_chat_metadata',
    run: (client) =>
      client.rpc('update_chat_metadata', {
        p_chat_id: randomUUID(),
        p_last_message: '[sync-check]',
        p_last_message_at: new Date().toISOString(),
      }),
  },
  {
    name: 'RPC get_chat_inbox (mobile inbox parity)',
    run: (client) => client.rpc('get_chat_inbox'),
  },
  {
    name: 'RPC is_chat_member helper',
    run: (client) => client.rpc('is_chat_member', { p_chat_id: randomUUID(), p_user_id: randomUUID() }),
  },
  {
    name: 'RPC mark_messages_as_read (mobile read parity)',
    run: (client) => client.rpc('mark_messages_as_read', { p_chat_id: randomUUID(), p_message_ids: null }),
  },
  {
    name: 'RPC join_chat (mobile chat parity)',
    run: (client) => client.rpc('join_chat', { p_chat_id: randomUUID() }),
  },
  {
    name: 'RPC respond_radar_invite (radar invite parity)',
    optionalMissing: true,
    warnIfSuccess:
      'eksekusi berhasil dengan runtime anon/publishable key; pastikan function memang membatasi auth.uid() sesuai kebijakan.',
    run: (client) => client.rpc('respond_radar_invite', { p_invite_id: randomUUID(), p_accept: false }),
  },
];

await runRpcChecks(runtimeClient, 'runtime anon/publishable key', rpcChecks);

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nHasil: masih ada mismatch schema/function. Cek output error di atas.');
  process.exit(process.exitCode);
}

console.log('\nHasil: baseline sinkronisasi web-mobile-admin tervalidasi.');
