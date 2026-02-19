import type { Post } from '@/lib/types';

export type PriorityMode = 'hot' | 'latest' | 'discussed';

export type PriorityFeedItem = {
  post: Post;
  score: number;
  engagement: number;
  ageHours: number;
  reason: string;
};

export const PRIORITY_ALGORITHM_VERSION = 'v1';

const PRIORITY_WEIGHTS = {
  likes: 2,
  comments: 3,
  reposts: 4,
  saves: 2,
  freshnessWindowHours: 36,
  freshnessDivisor: 6,
} as const;

export function rankPriorityFeed(
  posts: Post[],
  mode: PriorityMode,
  limit = 5
): PriorityFeedItem[] {
  const now = Date.now();

  const mapped = posts
    .map((post) => {
      const likes = post.likes_count ?? 0;
      const comments = post.comments_count ?? 0;
      const reposts = post.shares_count ?? 0;
      const saves = post.saves_count ?? 0;
      const engagement = likes + comments + reposts + saves;

      const createdAtMs = new Date(post.created_at).getTime();
      const ageHours = Number.isNaN(createdAtMs)
        ? 999
        : Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));
      const freshnessBoost =
        Math.max(0, PRIORITY_WEIGHTS.freshnessWindowHours - ageHours) /
        PRIORITY_WEIGHTS.freshnessDivisor;
      const score =
        likes * PRIORITY_WEIGHTS.likes +
        comments * PRIORITY_WEIGHTS.comments +
        reposts * PRIORITY_WEIGHTS.reposts +
        saves * PRIORITY_WEIGHTS.saves +
        freshnessBoost;

      let reason = 'Layak diprioritaskan';
      if (reposts >= 3) {
        reason = 'Sering direpost umat';
      } else if (comments >= 4) {
        reason = 'Diskusi sedang aktif';
      } else if (likes >= 8) {
        reason = 'Banyak respons positif';
      } else if (ageHours <= 6) {
        reason = 'Postingan terbaru';
      }

      return {
        post,
        score,
        engagement,
        ageHours,
        reason,
      } satisfies PriorityFeedItem;
    })
    .filter((item) => item.post.id.trim().length > 0);

  switch (mode) {
    case 'latest':
      mapped.sort((a, b) => {
        const aTime = new Date(a.post.created_at).getTime();
        const bTime = new Date(b.post.created_at).getTime();
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return bTime - aTime;
      });
      break;
    case 'discussed':
      mapped.sort((a, b) => {
        const commentsDiff =
          (b.post.comments_count ?? 0) - (a.post.comments_count ?? 0);
        if (commentsDiff !== 0) return commentsDiff;
        if (b.score !== a.score) return b.score - a.score;
        return b.engagement - a.engagement;
      });
      break;
    case 'hot':
    default:
      mapped.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.engagement - a.engagement;
      });
      break;
  }

  return mapped.slice(0, limit);
}
