// Feed Post Card

'use client';

import { useState, type ComponentType, type FormEvent, type MouseEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useAddComment,
  useComments,
  useSharePost,
  useToggleLike,
  useToggleSave,
} from '@/lib/features/feed/use-posts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/types';
import { Input } from '@/components/ui/input';

interface PostCardProps {
  post: Post;
  showFullImage?: boolean;
  onClick?: () => void;
}

export function PostCard({ post, showFullImage = false, onClick }: PostCardProps) {
  const { mutateAsync: toggleLike, isPending: isLiking } = useToggleLike();
  const { mutateAsync: toggleSave, isPending: isSaving } = useToggleSave();
  const { mutateAsync: sharePost, isPending: isSharing } = useSharePost();
  const { mutateAsync: addComment, isPending: isCommenting } = useAddComment();

  const authorName = post.profile?.full_name?.trim() || 'Umat';
  const avatarFallback = authorName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const media = post.image_url ?? [];
  const [imageIndex, setImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { data: comments = [], isLoading: isCommentsLoading } = useComments(post.id, showComments);
  const activeImageIndex = imageIndex >= media.length ? 0 : imageIndex;
  const isLiked = Boolean(post.is_liked);
  const isSaved = Boolean(post.is_saved);
  const likesCount = post.likes_count ?? 0;
  const commentsCount = post.comments_count ?? 0;

  const handleLike = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleLike(post.id);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleSave = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleSave(post.id);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleShare = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      const postLink = `${window.location.origin}/post/${post.id}`;

      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post on MyCatholic',
          url: postLink,
        });
      } else {
        await navigator.clipboard.writeText(postLink);
        toast.success('Link copied!');
      }

      await sharePost(post.id);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!content) return;

    try {
      await addComment({ postId: post.id, content });
      setCommentText('');
    } catch (error) {
      console.error('Comment error:', error);
    }
  };

  return (
    <Card
      className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_12px_28px_rgba(0,0,0,0.3)] transition-[border-color,box-shadow] hover:border-border/80 hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)] sm:rounded-3xl sm:shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:hover:shadow-[0_24px_58px_rgba(0,0,0,0.45)]"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border sm:h-11 sm:w-11">
              <AvatarImage src={post.profile?.avatar_url} alt={authorName} />
              <AvatarFallback>{avatarFallback || 'US'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none sm:text-base">{authorName}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground sm:h-9 sm:w-9"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {post.caption && (
          <div className="px-4 pb-3 sm:px-5 sm:pb-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-[15px]">{post.caption}</p>
          </div>
        )}

        {media.length > 0 && (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="relative overflow-hidden rounded-xl border border-border bg-black sm:rounded-2xl">
              {showFullImage && media.length === 1 ? (
                <img
                  src={media[0]}
                  alt={post.caption || 'Post'}
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : (
                <img
                  src={media[activeImageIndex]}
                  alt={`${post.caption || 'Post'} ${activeImageIndex + 1}`}
                  className="h-full max-h-[72vh] w-full object-contain"
                />
              )}

              {media.length > 1 && (
                <>
                  {activeImageIndex > 0 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-border bg-card/90 text-foreground hover:bg-card sm:left-3 sm:h-8 sm:w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        setImageIndex((current) => Math.max(current - 1, 0));
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}

                  {activeImageIndex < media.length - 1 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-border bg-card/90 text-foreground hover:bg-card sm:right-3 sm:h-8 sm:w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        setImageIndex((current) => Math.min(current + 1, media.length - 1));
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}

                  <span className="absolute bottom-3 right-3 rounded-full border border-border bg-card/85 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {activeImageIndex + 1}/{media.length}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-border px-2.5 py-2 sm:px-4">
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
            <ActionButton
              icon={Heart}
              label="Suka"
              active={isLiked}
              count={likesCount}
              onClick={handleLike}
              disabled={isLiking}
            />
            <ActionButton
              icon={MessageCircle}
              label="Komentar"
              count={commentsCount}
              onClick={(event) => {
                event.stopPropagation();
                setShowComments((current) => !current);
              }}
            />
            <ActionButton
              icon={Share2}
              label="Bagikan"
              count={post.shares_count}
              onClick={handleShare}
              disabled={isSharing}
            />
            <ActionButton
              icon={Bookmark}
              label="Simpan"
              active={isSaved}
              onClick={handleSave}
              disabled={isSaving}
            />
          </div>
        </div>

        {showComments && (
          <div
            className="space-y-3 border-t border-border px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            {isCommentsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat komentar...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const name = comment.profile?.full_name?.trim() || 'Umat';
                  const commentInitials =
                    name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'US';

                  return (
                    <div key={comment.id} className="flex items-start gap-2.5">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src={comment.profile?.avatar_url} alt={name} />
                        <AvatarFallback className="text-[10px]">{commentInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 rounded-xl border border-border bg-muted/35 px-3 py-2">
                        <p className="text-xs font-semibold">{name}</p>
                        <p className="text-sm text-foreground">{comment.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
              <Input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Tulis komentar..."
                disabled={isCommenting}
                className="h-10 rounded-full border-border bg-muted/25"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isCommenting || commentText.trim() === ''}
                className="h-10 rounded-full px-3 sm:px-4"
              >
                Kirim
              </Button>
            </form>
          </div>
        )}

        {(!showComments && (likesCount > 0 || commentsCount > 0)) && (
          <div className="flex items-center gap-4 px-4 pb-3 text-xs text-muted-foreground sm:px-5 sm:pb-4">
            {likesCount > 0 && <span>{likesCount} suka</span>}
            {commentsCount > 0 && <span>{commentsCount} komentar</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  count,
  active = false,
  onClick,
  disabled = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active?: boolean;
  onClick: (event: MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-9 rounded-lg px-1.5 text-[11px] text-muted-foreground hover:bg-muted/55 hover:text-foreground sm:h-10 sm:rounded-xl sm:px-2 sm:text-xs',
        active && 'text-primary'
      )}
    >
      <Icon className={cn('h-4 w-4 sm:mr-1.5', active && 'fill-current')} />
      <span className="sr-only sm:not-sr-only sm:inline">{label}</span>
      {typeof count === 'number' && count > 0 && <span className="ml-1 tabular-nums">{count}</span>}
    </Button>
  );
}
