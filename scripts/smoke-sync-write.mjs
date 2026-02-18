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

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
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

if (!testEmail || !testPassword) {
  fail('Isi E2E_TEST_EMAIL + E2E_TEST_PASSWORD untuk smoke write.');
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const signIn = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signIn.error || !signIn.data.user) {
    fail(`auth: gagal login (${signIn.error?.message || 'unknown error'})`);
    return;
  }

  const userId = signIn.data.user.id;
  pass('auth: login test user');

  let postId = '';
  let chatId = '';
  let messageId = '';

  try {
    const profileRes = await client
      .from('profiles')
      .select('country_id, diocese_id, church_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileRes.error) {
      fail(`profiles read: ${profileRes.error.message}`);
      return;
    }

    const postRes = await client
      .from('posts')
      .insert({
        user_id: userId,
        caption: `[smoke-write] ${new Date().toISOString()}`,
        image_url: [],
        type: 'text',
        country_id: profileRes.data?.country_id ?? null,
        diocese_id: profileRes.data?.diocese_id ?? null,
        church_id: profileRes.data?.church_id ?? null,
      })
      .select('id')
      .single();

    if (postRes.error || !postRes.data?.id) {
      fail(`feed create post: ${postRes.error?.message || 'unknown error'}`);
      return;
    }

    postId = postRes.data.id.toString();
    pass('feed: create post');

    const likeRes = await client.from('likes').insert({
      post_id: postId,
      user_id: userId,
    });
    if (likeRes.error) {
      fail(`feed like: ${likeRes.error.message}`);
      return;
    }
    pass('feed: like');

    const saveRes = await client.from('saved_posts').insert({
      post_id: postId,
      user_id: userId,
    });
    if (saveRes.error) {
      fail(`feed save: ${saveRes.error.message}`);
      return;
    }
    pass('feed: save');

    const commentRes = await client.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: '[smoke-comment]',
    });
    if (commentRes.error) {
      fail(`feed comment: ${commentRes.error.message}`);
      return;
    }
    pass('feed: comment');

    const shareRpc = await client.rpc('increment_shares', {
      p_post_id: postId,
    });
    if (shareRpc.error) {
      fail(`feed share RPC: ${shareRpc.error.message}`);
      return;
    }
    pass('feed: share via RPC');

    const chatRes = await client
      .from('social_chats')
      .insert({
        is_group: true,
        group_name: `[smoke-chat] ${Date.now()}`,
        admin_id: userId,
        creator_id: userId,
        participants: [userId],
        invite_mode: 'open',
        invite_link_enabled: false,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (chatRes.error || !chatRes.data?.id) {
      fail(`chat create temp room: ${chatRes.error?.message || 'unknown error'}`);
      return;
    }

    chatId = chatRes.data.id.toString();
    pass('chat: create temp room');

    const messageRes = await client
      .from('social_messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: `[smoke-message] ${new Date().toISOString()}`,
        message_type: 'text',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (messageRes.error || !messageRes.data?.id) {
      fail(`chat send message: ${messageRes.error?.message || 'unknown error'}`);
      return;
    }

    messageId = messageRes.data.id.toString();
    pass('chat: send message');

    const metadataRes = await client.rpc('update_chat_metadata', {
      p_chat_id: chatId,
      p_last_message: '[smoke-message]',
      p_last_message_at: new Date().toISOString(),
    });

    if (metadataRes.error) {
      fail(`chat metadata update: ${metadataRes.error.message}`);
      return;
    }

    pass('chat: metadata update');
  } finally {
    if (messageId) {
      await client.from('social_messages').delete().eq('id', messageId);
    }
    if (chatId) {
      await client.from('chat_members').delete().eq('chat_id', chatId);
      await client.from('social_chats').delete().eq('id', chatId);
    }
    if (postId) {
      await client.from('saved_posts').delete().eq('post_id', postId).eq('user_id', userId);
      await client.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      await client.from('comments').delete().eq('post_id', postId);
      await client.from('post_shares').delete().eq('post_id', postId);
      await client.from('posts').delete().eq('id', postId);
    }

    await client.auth.signOut();
    pass('cleanup');
  }
}

await main();

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nHasil: smoke write menemukan error yang perlu diperbaiki.');
  process.exit(process.exitCode);
}

console.log('\nHasil: smoke write feed + chat lulus.');
