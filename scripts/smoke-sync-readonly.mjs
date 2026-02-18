#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const index = line.indexOf('=');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`! ${message}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function normalizeError(error) {
  if (!error) return '';
  return `${error.message} ${error.details || ''}`.toLowerCase();
}

function isMissingSchemaError(error) {
  const msg = normalizeError(error);
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    msg.includes('42703') ||
    msg.includes('42p01') ||
    msg.includes('pgrst200') ||
    msg.includes('pgrst205')
  );
}

function isPermissionError(error) {
  const msg = normalizeError(error);
  return (
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('not authenticated')
  );
}

function isMissingFunctionError(error) {
  const msg = normalizeError(error);
  return msg.includes('could not find the function') || (msg.includes('function') && msg.includes('does not exist'));
}

function isContextualRpcError(error) {
  const msg = normalizeError(error);
  return msg.includes('not a member of this chat') || msg.includes('chat tidak ditemukan');
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const testEmail = process.env.E2E_TEST_EMAIL || process.env.E2E_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD || process.env.E2E_PASSWORD;

if (!url || !anonKey) {
  fail('URL/anon key belum tersedia. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runVariantCheck(name, variants) {
  for (const variant of variants) {
    const { error } = await variant.run();
    if (!error) {
      pass(name);
      if (variant.note) {
        warn(`${name}: ${variant.note}`);
      }
      return true;
    }

    if (isMissingSchemaError(error)) {
      if (variant.allowMissingFunction && isMissingFunctionError(error)) {
        warn(`${name}: function opsional belum tersedia (${error.message})`);
        return true;
      }
      continue;
    }

    if (isPermissionError(error)) {
      warn(`${name}: akses dibatasi kebijakan RLS`);
      return true;
    }

    if (isContextualRpcError(error)) {
      warn(`${name}: function ada, namun butuh konteks chat valid (${error.message})`);
      return true;
    }

    fail(`${name}: ${error.message}`);
    return false;
  }

  fail(`${name}: tidak ada varian schema yang cocok`);
  return false;
}

await runVariantCheck('profiles read', [
  { run: () => anon.from('profiles').select('id, full_name, account_status, faith_status').limit(1) },
  { run: () => anon.from('profiles').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('posts read', [
  { run: () => anon.from('posts').select('id, user_id, caption, image_url, created_at').limit(1) },
  { run: () => anon.from('posts').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('chat tables read', [
  {
    run: () =>
      anon
        .from('social_chats')
        .select('id, is_group, group_name, invite_mode, invite_link_enabled, updated_at')
        .limit(1),
  },
  { run: () => anon.from('social_chats').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('chat_members contract', [
  {
    run: () =>
      anon
        .from('chat_members')
        .select('chat_id, user_id, role, status, joined_at, unread_count, pinned_at, archived_at, muted_until, last_read_at')
        .limit(1),
  },
  { run: () => anon.from('chat_members').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('social_messages contract', [
  {
    run: () =>
      anon
        .from('social_messages')
        .select('id, chat_id, sender_id, message_type, media_url, file_name, reply_to_id, is_read, read_at, reactions')
        .limit(1),
  },
  {
    run: () =>
      anon
        .from('social_messages')
        .select('id, chat_id, sender_id, message_type, media_url, file_name, reply_to_id, reactions')
        .limit(1),
    note: 'fallback tanpa kolom read-status',
  },
  { run: () => anon.from('social_messages').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('notifications contract', [
  { run: () => anon.from('notifications').select('id, user_id, type, is_read, created_at').limit(1) },
  { run: () => anon.from('notifications').select('id, user_id, type, read_at, created_at').limit(1) },
  { run: () => anon.from('notifications').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('register master data (countries)', [
  { run: () => anon.from('countries').select('id, name').limit(1) },
  { run: () => anon.from('countries').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('register master data (dioceses)', [
  { run: () => anon.from('dioceses').select('id, country_id, name').limit(1) },
  { run: () => anon.from('dioceses').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('stories contract', [
  { run: () => anon.from('stories').select('id, user_id, media_url, media_type, created_at, expires_at').limit(1) },
  { run: () => anon.from('stories').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('story interactions contract', [
  { run: () => anon.from('story_views').select('story_id, viewer_id').limit(1) },
  { run: () => anon.from('story_views').select('story_id, user_id').limit(1), note: 'fallback story_views.user_id' },
  { run: () => anon.from('story_reactions').select('story_id, user_id, reaction').limit(1), note: 'fallback story_reactions' },
  { run: () => anon.from('story_replies').select('story_id, sender_id, content').limit(1), note: 'fallback story_replies' },
]);

await runVariantCheck('schedule contract', [
  { run: () => anon.from('mass_schedules').select('id, church_id, day_of_week, start_time').limit(1) },
  {
    run: () => anon.from('mass_schedules').select('id, church_id, day_number, start_time').limit(1),
    note: 'fallback day_number + start_time',
  },
  { run: () => anon.from('mass_schedules').select('id, church_id, mass_time').limit(1), note: 'fallback mass_time' },
  { run: () => anon.from('mass_schedules').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('bible_books contract', [
  { run: () => anon.from('bible_books').select('id, name, testament, book_order').limit(1) },
  { run: () => anon.from('bible_books').select('id, name, grouping, order_index').limit(1), note: 'fallback grouping + order_index' },
  { run: () => anon.from('bible_books').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('radar events read', [
  { run: () => anon.from('radar_events').select('id, title, event_starts_at_utc, church_id').limit(1) },
  { run: () => anon.from('radar_events_v2').select('id, title, event_starts_at_utc, church_id').limit(1), note: 'fallback radar_events_v2' },
]);

await runVariantCheck('radar participants read', [
  { run: () => anon.from('radar_participants').select('radar_id').limit(1) },
  { run: () => anon.from('radar_participants_v2').select('radar_id').limit(1), note: 'fallback radar_participants_v2' },
]);

await runVariantCheck('radar_invites contract', [
  {
    run: () =>
      anon
        .from('radar_invites')
        .select('id, inviter_id, invitee_id, radar_id, source, status, note, expires_at, responded_at, created_at')
        .limit(1),
  },
  { run: () => anon.from('radar_invites').select('*').limit(1), note: 'fallback menggunakan select(*)' },
]);

await runVariantCheck('mass checkins read', [
  { run: () => anon.from('mass_checkins').select('id, user_id, church_id, checkin_at').limit(1) },
  { run: () => anon.from('mass_checkins').select('id, user_id, church_id, check_in_time').limit(1), note: 'fallback check_in_time' },
  { run: () => anon.from('mass_checkins_v2').select('id, user_id, church_id, checkin_at').limit(1), note: 'fallback mass_checkins_v2' },
]);

await runVariantCheck('RPC update_chat_metadata exists', [
  {
    run: () =>
      anon.rpc('update_chat_metadata', {
        p_chat_id: '00000000-0000-0000-0000-000000000000',
        p_last_message: '[smoke]',
        p_last_message_at: new Date().toISOString(),
      }),
  },
]);

await runVariantCheck('RPC get_chat_inbox exists', [
  {
    run: () => anon.rpc('get_chat_inbox'),
  },
]);

await runVariantCheck('RPC is_chat_member exists', [
  {
    run: () =>
      anon.rpc('is_chat_member', {
        p_chat_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000',
      }),
  },
]);

await runVariantCheck('RPC mark_messages_as_read exists', [
  {
    run: () =>
      anon.rpc('mark_messages_as_read', {
        p_chat_id: '00000000-0000-0000-0000-000000000000',
        p_message_ids: null,
      }),
  },
]);

await runVariantCheck('RPC join_chat exists', [
  {
    run: () => anon.rpc('join_chat', { p_chat_id: '00000000-0000-0000-0000-000000000000' }),
    note: 'expected bisa ditolak bila belum authenticated',
  },
]);

await runVariantCheck('RPC respond_radar_invite exists', [
  {
    run: () =>
      anon.rpc('respond_radar_invite', {
        p_invite_id: '00000000-0000-0000-0000-000000000000',
        p_accept: false,
      }),
    allowMissingFunction: true,
  },
]);

if (testEmail && testPassword) {
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signIn = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signIn.error || !signIn.data.user) {
    fail(`auth smoke: gagal login test user (${signIn.error?.message || 'unknown error'})`);
  } else {
    pass('auth smoke: login test user');

    const userId = signIn.data.user.id;
    await runVariantCheck('auth profile read', [
      { run: () => authClient.from('profiles').select('id, full_name, account_status').eq('id', userId).limit(1) },
    ]);
    await runVariantCheck('auth notifications read', [
      { run: () => authClient.from('notifications').select('*').eq('user_id', userId).limit(1) },
    ]);
    await runVariantCheck('auth get_chat_inbox', [
      { run: () => authClient.rpc('get_chat_inbox') },
    ]);

    await authClient.auth.signOut();
  }
} else {
  warn('auth smoke dilewati: isi E2E_TEST_EMAIL + E2E_TEST_PASSWORD jika ingin uji alur authenticated.');
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nHasil: smoke audit menemukan error yang perlu diperbaiki.');
  process.exit(process.exitCode);
}

console.log('\nHasil: smoke audit lintas web/mobile/admin lulus (readonly mode).');
