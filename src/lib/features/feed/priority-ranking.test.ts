import assert from 'node:assert/strict';
import test from 'node:test';
import type { Post } from '../../types/feed';
import { rankPriorityFeed } from './priority-ranking';

function makePost(overrides: Partial<Post> & { id: string; created_at: string }): Post {
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? 'user-1',
    caption: overrides.caption,
    image_url: overrides.image_url,
    type: overrides.type,
    country_id: overrides.country_id,
    diocese_id: overrides.diocese_id,
    church_id: overrides.church_id,
    likes_count: overrides.likes_count ?? 0,
    comments_count: overrides.comments_count ?? 0,
    shares_count: overrides.shares_count ?? 0,
    saves_count: overrides.saves_count ?? 0,
    created_at: overrides.created_at,
    updated_at: overrides.updated_at ?? overrides.created_at,
    profile: overrides.profile,
    is_liked: overrides.is_liked,
    is_saved: overrides.is_saved,
    is_reposted: overrides.is_reposted,
  };
}

function withFixedNow<T>(isoDate: string, fn: () => T): T {
  const fixedTime = new Date(isoDate).getTime();
  const originalNow = Date.now;
  Date.now = () => fixedTime;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

test('hot mode follows weighted engagement priority', () => {
  const ranked = withFixedNow('2026-02-19T12:00:00.000Z', () =>
    rankPriorityFeed(
      [
        makePost({
          id: 'many-likes',
          created_at: '2026-02-19T10:00:00.000Z',
          likes_count: 12,
          comments_count: 0,
          shares_count: 0,
          saves_count: 0,
        }),
        makePost({
          id: 'many-reposts',
          created_at: '2026-02-19T10:00:00.000Z',
          likes_count: 2,
          comments_count: 2,
          shares_count: 5,
          saves_count: 0,
        }),
      ],
      'hot',
      5
    )
  );

  assert.equal(ranked[0]?.post.id, 'many-reposts');
  assert.equal(ranked[1]?.post.id, 'many-likes');
});

test('hot mode gives freshness advantage for equal engagement', () => {
  const ranked = withFixedNow('2026-02-19T12:00:00.000Z', () =>
    rankPriorityFeed(
      [
        makePost({
          id: 'older',
          created_at: '2026-02-18T00:00:00.000Z',
          likes_count: 4,
          comments_count: 1,
          shares_count: 0,
          saves_count: 0,
        }),
        makePost({
          id: 'newer',
          created_at: '2026-02-19T11:00:00.000Z',
          likes_count: 4,
          comments_count: 1,
          shares_count: 0,
          saves_count: 0,
        }),
      ],
      'hot',
      5
    )
  );

  assert.equal(ranked[0]?.post.id, 'newer');
});

test('latest mode sorts strictly by created_at desc', () => {
  const ranked = rankPriorityFeed(
    [
      makePost({
        id: 'old-top-engagement',
        created_at: '2026-02-10T10:00:00.000Z',
        likes_count: 99,
        comments_count: 99,
        shares_count: 99,
      }),
      makePost({
        id: 'new-low-engagement',
        created_at: '2026-02-19T10:00:00.000Z',
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
      }),
    ],
    'latest',
    5
  );

  assert.equal(ranked[0]?.post.id, 'new-low-engagement');
  assert.equal(ranked[1]?.post.id, 'old-top-engagement');
});

test('discussed mode prioritizes comments before generic score', () => {
  const ranked = rankPriorityFeed(
    [
      makePost({
        id: 'viral-repost',
        created_at: '2026-02-19T10:00:00.000Z',
        likes_count: 5,
        comments_count: 2,
        shares_count: 8,
      }),
      makePost({
        id: 'active-discussion',
        created_at: '2026-02-19T10:00:00.000Z',
        likes_count: 1,
        comments_count: 7,
        shares_count: 0,
      }),
    ],
    'discussed',
    5
  );

  assert.equal(ranked[0]?.post.id, 'active-discussion');
});

test('ranking enforces limit and ignores invalid post ids', () => {
  const ranked = rankPriorityFeed(
    [
      makePost({
        id: '',
        created_at: '2026-02-19T10:00:00.000Z',
        comments_count: 10,
      }),
      makePost({
        id: 'keep-1',
        created_at: '2026-02-19T10:00:00.000Z',
        likes_count: 2,
      }),
      makePost({
        id: 'keep-2',
        created_at: '2026-02-19T09:00:00.000Z',
        likes_count: 1,
      }),
    ],
    'hot',
    1
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.post.id, 'keep-1');
});
