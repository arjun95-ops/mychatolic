// Feed Post Card

'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Send,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  useAddComment,
  useBlockUser,
  useComments,
  useDeleteComment,
  useDeletePost,
  usePostLikes,
  useReportComment,
  useReportPost,
  useToggleCommentLike,
  useUpdatePost,
  useToggleLike,
  useToggleRepost,
  useToggleSave,
} from '@/lib/features/feed/use-posts';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Comment, Post } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/features/auth/use-auth';
import { supabase } from '@/lib/supabase/client';
import { FeedService } from '@/lib/features/feed/feed-service';
import { UPLOAD_LIMITS } from '@/lib/constants';

const REPORT_REASONS = ['Spam', 'Ujaran Kebencian', 'Penipuan', 'Informasi Palsu', 'Lainnya'];

interface PostCardProps {
  post: Post;
  showFullImage?: boolean;
  onClick?: () => void;
  originText?: string | null;
  initialCommentsOpen?: boolean;
}

type CommentThread = {
  root: Comment;
  replies: Comment[];
};

export function PostCard({
  post,
  showFullImage = false,
  onClick,
  originText,
  initialCommentsOpen = false,
}: PostCardProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: toggleLike, isPending: isLiking } = useToggleLike();
  const { mutateAsync: toggleSave, isPending: isSaving } = useToggleSave();
  const { mutateAsync: toggleRepost, isPending: isReposting } = useToggleRepost();
  const { mutateAsync: updatePost, isPending: isUpdatingPost } = useUpdatePost();
  const { mutateAsync: removePost, isPending: isDeletingPost } = useDeletePost();
  const { mutateAsync: reportPost, isPending: isReportingPost } = useReportPost();
  const { mutateAsync: blockUser, isPending: isBlockingUser } = useBlockUser();
  const { mutateAsync: addComment, isPending: isCommenting } = useAddComment();
  const { mutateAsync: toggleCommentLike, isPending: isTogglingCommentLike } = useToggleCommentLike();
  const { mutateAsync: deleteComment, isPending: isDeletingComment } = useDeleteComment();
  const { mutateAsync: reportComment, isPending: isReportingComment } = useReportComment();

  const authorName = post.profile?.full_name?.trim() || 'Umat';
  const viewerName = profile?.full_name?.trim() || user?.email?.trim() || 'Umat';
  const viewerInitials =
    viewerName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'UM';
  const avatarFallback = authorName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const media = post.image_url ?? [];
  const [imageIndex, setImageIndex] = useState(0);
  const [likeAnimationKey, setLikeAnimationKey] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [hasAutoOpenedComments, setHasAutoOpenedComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreviewUrl, setCommentImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingCommentImage, setIsUploadingCommentImage] = useState(false);
  const commentImageInputRef = useRef<HTMLInputElement>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [expandedReplyParents, setExpandedReplyParents] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReportPostDialogOpen, setIsReportPostDialogOpen] = useState(false);
  const [isReportCommentDialogOpen, setIsReportCommentDialogOpen] = useState(false);
  const [commentImageViewer, setCommentImageViewer] = useState<{ url: string; alt: string } | null>(null);
  const [isSharingLink, setIsSharingLink] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption?.trim() ?? '');
  const [reportPostReason, setReportPostReason] = useState(REPORT_REASONS[0]);
  const [reportCommentReason, setReportCommentReason] = useState(REPORT_REASONS[0]);
  const [reportCommentTarget, setReportCommentTarget] = useState<{ id: string; userName: string } | null>(null);
  const {
    comments,
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    isFetchingNextPage: isLoadingMoreComments,
    hasMore: hasMoreComments,
    loadMore: loadMoreComments,
    refetch: refetchComments,
  } = useComments(post.id, isCommentsOpen);
  const activeImageIndex = imageIndex >= media.length ? 0 : imageIndex;
  const isLiked = Boolean(post.is_liked);
  const isSaved = Boolean(post.is_saved);
  const isReposted = Boolean(post.is_reposted);
  const isOwner = Boolean(user?.id && user.id === post.user_id);
  const likesCount = post.likes_count ?? 0;
  const commentsCount = post.comments_count ?? 0;
  const sharesCount = post.shares_count ?? 0;
  const savesCount = post.saves_count ?? 0;
  const { data: likers = [] } = usePostLikes(post.id, likesCount > 0);
  const firstLikerName = likers[0]?.profile?.full_name?.trim();
  const likesPreviewText = firstLikerName
    ? likesCount > 1
      ? `Disukai oleh ${firstLikerName} dan lainnya`
      : `Disukai oleh ${firstLikerName}`
    : `Disukai oleh ${likesCount} orang`;
  const postCreatedAt = new Date(post.created_at);
  const postTimeLabel = Number.isNaN(postCreatedAt.getTime())
    ? '-'
    : formatDistanceToNow(postCreatedAt, { addSuffix: true, locale: localeId });
  const { commentThreads, commentRootById } = useMemo(() => {
    const byId = new Map<string, Comment>();
    for (const comment of comments) {
      byId.set(comment.id, comment);
    }

    const resolveRootId = (comment: Comment): string => {
      const seen = new Set<string>([comment.id]);
      let cursor = comment;

      while (cursor.parent_id) {
        const parent = byId.get(cursor.parent_id);
        if (!parent || seen.has(parent.id)) {
          break;
        }
        seen.add(parent.id);
        cursor = parent;
      }

      return cursor.id;
    };

    const rootOrder: string[] = [];
    const seenRoots = new Set<string>();
    const rootByCommentId = new Map<string, string>();
    const threads = new Map<string, CommentThread>();

    for (const comment of comments) {
      const rootId = resolveRootId(comment);
      rootByCommentId.set(comment.id, rootId);

      if (!seenRoots.has(rootId)) {
        seenRoots.add(rootId);
        rootOrder.push(rootId);
      }

      const rootComment = byId.get(rootId) ?? comment;
      const existingThread = threads.get(rootId);
      if (!existingThread) {
        threads.set(rootId, {
          root: rootComment,
          replies: comment.id === rootId ? [] : [comment],
        });
        continue;
      }

      if (comment.id !== rootId) {
        existingThread.replies.push(comment);
      }
    }

    const orderedThreads = rootOrder
      .map((rootId) => threads.get(rootId))
      .filter((thread): thread is CommentThread => Boolean(thread));

    return {
      commentThreads: orderedThreads,
      commentRootById: rootByCommentId,
    };
  }, [comments]);
  const isSubmittingComment = isCommenting || isUploadingCommentImage;
  const canSubmitComment = commentText.trim() !== '' || Boolean(commentImageFile);

  useEffect(() => {
    setImageIndex(0);
    setIsCommentsOpen(false);
    setHasAutoOpenedComments(false);
    setCommentText('');
    setReplyTarget(null);
    setExpandedReplyParents(new Set());
    setCommentImageFile(null);
    setCommentImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    if (commentImageInputRef.current) {
      commentImageInputRef.current.value = '';
    }
  }, [post.id]);

  useEffect(() => {
    if (!initialCommentsOpen || hasAutoOpenedComments) return;
    setIsCommentsOpen(true);
    setHasAutoOpenedComments(true);
  }, [hasAutoOpenedComments, initialCommentsOpen]);

  const clearCommentImage = () => {
    setCommentImageFile(null);
    setCommentImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });

    if (commentImageInputRef.current) {
      commentImageInputRef.current.value = '';
    }
  };

  const handleCommentImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isAllowedImageType = UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.some((allowedType) => allowedType === file.type);
    if (!isAllowedImageType) {
      toast.error('Format gambar harus JPG, PNG, GIF, atau WEBP');
      event.target.value = '';
      return;
    }

    if (file.size > UPLOAD_LIMITS.MAX_IMAGE_SIZE) {
      toast.error('Ukuran file maksimal 5MB');
      event.target.value = '';
      return;
    }

    setCommentImageFile(file);
    setCommentImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
    event.target.value = '';
  };

  const handleLike = async (event: MouseEvent) => {
    event.stopPropagation();
    if (!isLiked) {
      setLikeAnimationKey((prev) => prev + 1);
    }
    try {
      await toggleLike(post.id);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleSave = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      await toggleSave(post.id);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleRepost = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      await toggleRepost(post.id);
    } catch (error) {
      console.error('Repost error:', error);
    }
  };

  const handleShare = async (event: MouseEvent) => {
    event.stopPropagation();
    if (isSharingLink) return;
    const postLink = `${window.location.origin}/post/${post.id}`;

    try {
      setIsSharingLink(true);
      if (navigator.share) {
        await navigator.share({
          title: 'MyCatholic',
          text: 'Lihat postingan ini di MyCatholic',
          url: postLink,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postLink);
        toast.success('Link postingan disalin');
      } else {
        toast.info(postLink);
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setIsSharingLink(false);
    }
  };

  const handleSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!content && !commentImageFile) return;
    const targetParentId = replyTarget?.id;

    try {
      let uploadedImageUrl: string | undefined;
      if (commentImageFile) {
        if (!user?.id) {
          throw new Error('Anda harus login untuk upload gambar komentar');
        }

        setIsUploadingCommentImage(true);
        uploadedImageUrl = await FeedService.uploadCommentImage(user.id, commentImageFile);
      }

      await addComment({
        postId: post.id,
        content,
        parentId: targetParentId,
        replyToName: replyTarget?.name,
        imageUrl: uploadedImageUrl,
      });
      if (targetParentId) {
        setExpandedReplyParents((prev) => {
          const next = new Set(prev);
          next.add(targetParentId);
          return next;
        });
      }
      setCommentText('');
      setReplyTarget(null);
      clearCommentImage();
    } catch (error) {
      console.error('Comment error:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mengirim komentar');
    } finally {
      setIsUploadingCommentImage(false);
    }
  };

  const handleCommentInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (!canSubmitComment || isSubmittingComment) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const handleDeleteComment = async (commentId: string, commentUserId?: string) => {
    if (!user?.id || commentUserId !== user.id) {
      toast.error('Anda hanya bisa menghapus komentar sendiri');
      return;
    }

    try {
      await deleteComment({ postId: post.id, commentId });
    } catch (error) {
      console.error('Delete comment error:', error);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    try {
      await toggleCommentLike({ postId: post.id, commentId });
    } catch (error) {
      console.error('Comment like error:', error);
    }
  };

  const handleEditPost = async () => {
    const nextCaption = editCaption.trim();
    if (!nextCaption) {
      toast.error('Caption tidak boleh kosong');
      return;
    }

    try {
      await updatePost({ postId: post.id, caption: nextCaption });
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Update post error:', error);
    }
  };

  const handleDeletePost = async () => {
    try {
      await removePost(post.id);
      setIsDeleteDialogOpen(false);
      setIsCommentsOpen(false);
    } catch (error) {
      console.error('Delete post error:', error);
    }
  };

  const handleReportPost = async () => {
    try {
      await reportPost({ postId: post.id, reason: reportPostReason });
      setIsReportPostDialogOpen(false);
    } catch (error) {
      console.error('Report post error:', error);
    }
  };

  const handleReportComment = async () => {
    if (!reportCommentTarget) return;

    try {
      await reportComment({
        commentId: reportCommentTarget.id,
        reason: reportCommentReason,
      });
      setIsReportCommentDialogOpen(false);
      setReportCommentTarget(null);
    } catch (error) {
      console.error('Report comment error:', error);
    }
  };

  const handleBlockAuthor = async () => {
    if (!user?.id) {
      toast.error('Anda harus login');
      return;
    }

    if (!post.user_id || post.user_id === user.id) {
      toast.error('User tidak valid');
      return;
    }

    try {
      await blockUser(post.user_id);
      setIsCommentsOpen(false);
    } catch (error) {
      console.error('Block user error:', error);
    }
  };

  useEffect(() => {
    if (!isCommentsOpen || !post.id) return;

    const channel = supabase
      .channel(`post-comments-${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
          queryClient.invalidateQueries({ queryKey: ['post', post.id] });
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_likes',
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isCommentsOpen, post.id, queryClient]);

  useEffect(() => {
    return () => {
      if (commentImagePreviewUrl) {
        URL.revokeObjectURL(commentImagePreviewUrl);
      }
    };
  }, [commentImagePreviewUrl]);

  return (
    <>
      <Card
        className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition-[border-color,box-shadow] hover:border-border/80 hover:shadow-[0_18px_40px_rgba(0,0,0,0.32)] sm:rounded-3xl"
        onClick={onClick}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="mt-0.5 h-10 w-10 border border-border sm:h-11 sm:w-11">
                <AvatarImage src={post.profile?.avatar_url} alt={authorName} />
                <AvatarFallback>{avatarFallback || 'US'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none sm:text-base">{authorName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{postTimeLabel}</p>
                {originText && (
                  <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{originText}</p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground sm:h-9 sm:w-9"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {isOwner ? (
                  <>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditCaption(post.caption?.trim() ?? '');
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit postingan
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                      Hapus postingan
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        setReportPostReason(REPORT_REASONS[0]);
                        setIsReportPostDialogOpen(true);
                      }}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Laporkan postingan
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isBlockingUser}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleBlockAuthor();
                      }}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      {isBlockingUser ? 'Memblokir...' : 'Blokir user ini'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
              <ActionButton
                icon={Flame}
                label="Suka"
                active={isLiked}
                activeClassName="!text-[#FF3B00] hover:!text-[#FF3B00] font-semibold"
                activeIconClassName="!text-[#FF3B00] [filter:drop-shadow(0_0_6px_rgba(255,59,0,0.55))] [&>path]:fill-current [&>path]:stroke-current"
                activeCountClassName="!text-[#FF3B00] font-bold"
                iconProps={isLiked ? { strokeWidth: 1.8 } : { strokeWidth: 2 }}
                iconAnimationKey={likeAnimationKey > 0 ? likeAnimationKey : undefined}
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
                  setIsCommentsOpen(true);
                }}
              />
              <ActionButton
                icon={Repeat2}
                label="Repost"
                active={isReposted}
                count={sharesCount}
                onClick={handleRepost}
                disabled={isReposting}
              />
              <ActionButton
                icon={Send}
                label="Kirim"
                onClick={handleShare}
                disabled={isSharingLink}
              />
              <ActionButton
                icon={Bookmark}
                label="Simpan"
                active={isSaved}
                count={savesCount}
                onClick={handleSave}
                disabled={isSaving}
              />
            </div>
          </div>

          {likesCount > 0 && (
            <div className="px-4 pb-3 text-xs text-muted-foreground sm:px-5 sm:pb-4">
              <p className="truncate">{likesPreviewText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCommentsOpen}
        onOpenChange={(nextOpen) => {
          setIsCommentsOpen(nextOpen);
          if (!nextOpen) {
            setReplyTarget(null);
            setCommentText('');
            setExpandedReplyParents(new Set());
            clearCommentImage();
          }
        }}
      >
        <DialogContent className="max-h-[86vh] gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 sm:max-w-[720px]">
          <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
            <DialogTitle className="text-xl font-semibold">Komentar</DialogTitle>
            <DialogDescription className="truncate text-sm text-muted-foreground">
              Diskusi postingan dari {authorName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[72vh] min-h-[440px] flex-col sm:h-[70vh]">
            <div className="flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-5">
              {isCommentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex items-start gap-3 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-muted" />
                        <div className="h-4 w-11/12 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isCommentsError ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                  <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">Komentar gagal dimuat</p>
                  <p className="mt-1 text-xs text-muted-foreground">Periksa koneksi lalu coba lagi.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => void refetchComments()}
                  >
                    Coba lagi
                  </Button>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                  <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">Belum ada komentar</p>
                  <p className="mt-1 text-xs text-muted-foreground">Jadilah yang pertama memulai diskusi.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {commentThreads.map((thread) => {
                    const isRepliesExpanded = expandedReplyParents.has(thread.root.id);
                    const rootName = thread.root.profile?.full_name?.trim() || 'Umat';
                    const rootInitials =
                      rootName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'US';
                    const isMyRootComment = Boolean(user?.id && user.id === thread.root.user_id);
                    const rootCreatedAt = new Date(thread.root.created_at);
                    const rootTimeLabel = Number.isNaN(rootCreatedAt.getTime())
                      ? '-'
                      : formatDistanceToNow(rootCreatedAt, { addSuffix: true, locale: localeId });
                    const rootContent = thread.root.content?.trim() ?? '';

                    const handleReplyToComment = (comment: Comment, name: string) => {
                      const rootId = commentRootById.get(comment.id) ?? comment.parent_id ?? comment.id;
                      setReplyTarget({ id: rootId, name });
                      setExpandedReplyParents((prev) => {
                        const next = new Set(prev);
                        next.add(rootId);
                        return next;
                      });
                    };

                    return (
                      <div key={thread.root.id} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarImage src={thread.root.profile?.avatar_url} alt={rootName} />
                            <AvatarFallback className="text-[10px]">{rootInitials}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-semibold">{rootName}</p>
                              <span className="text-[11px] text-muted-foreground">{rootTimeLabel}</span>
                            </div>
                            {rootContent.length > 0 && (
                              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                                {thread.root.content}
                              </p>
                            )}
                            {thread.root.image_url && (
                              <div className="mt-2 w-fit max-w-[min(78vw,320px)] overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:max-w-[360px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentImageViewer({
                                      url: thread.root.image_url || '',
                                      alt: `Lampiran komentar ${rootName}`,
                                    })
                                  }
                                  className="inline-block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                  <img
                                    src={thread.root.image_url}
                                    alt="Lampiran komentar"
                                    className="block h-auto max-h-[320px] w-auto max-w-full object-contain transition-transform duration-200 hover:scale-[1.01]"
                                    loading="lazy"
                                  />
                                </button>
                              </div>
                            )}

                            <div className="mt-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleReplyToComment(thread.root, rootName)}
                                  className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                                >
                                  Balas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleCommentLike(thread.root.id)}
                                  disabled={isTogglingCommentLike}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-semibold transition-colors',
                                    thread.root.is_liked
                                      ? 'text-[#FF3B00] hover:text-[#FF3B00]'
                                      : 'text-muted-foreground hover:text-primary'
                                  )}
                                >
                                  <Flame
                                    className={cn(
                                      'h-3.5 w-3.5',
                                      thread.root.is_liked && '[&>path]:fill-current [&>path]:stroke-current'
                                    )}
                                  />
                                  <span>{thread.root.likes_count && thread.root.likes_count > 0 ? thread.root.likes_count : 'Suka'}</span>
                                </button>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {isMyRootComment ? (
                                    <DropdownMenuItem
                                      disabled={isDeletingComment}
                                      onClick={() => handleDeleteComment(thread.root.id, thread.root.user_id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                      Hapus komentar
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setReportCommentReason(REPORT_REASONS[0]);
                                        setReportCommentTarget({ id: thread.root.id, userName: rootName });
                                        setIsReportCommentDialogOpen(true);
                                      }}
                                    >
                                      <Flag className="mr-2 h-4 w-4" />
                                      Laporkan komentar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {thread.replies.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedReplyParents((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(thread.root.id)) {
                                      next.delete(thread.root.id);
                                    } else {
                                      next.add(thread.root.id);
                                    }
                                    return next;
                                  })
                                }
                                className="mt-1.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80"
                              >
                                {isRepliesExpanded
                                  ? 'Sembunyikan balasan'
                                  : `Lihat ${thread.replies.length} balasan`}
                              </button>
                            )}
                          </div>
                        </div>

                        {isRepliesExpanded && thread.replies.length > 0 && (
                          <div className="ml-11 space-y-2">
                            {thread.replies.map((reply) => {
                              const replyName = reply.profile?.full_name?.trim() || 'Umat';
                              const replyInitials =
                                replyName
                                  .split(' ')
                                  .map((part) => part[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2) || 'US';
                              const isMyReply = Boolean(user?.id && user.id === reply.user_id);
                              const replyCreatedAt = new Date(reply.created_at);
                              const replyTimeLabel = Number.isNaN(replyCreatedAt.getTime())
                                ? '-'
                                : formatDistanceToNow(replyCreatedAt, { addSuffix: true, locale: localeId });
                              const replyContent = reply.content?.trim() ?? '';

                              return (
                                <div key={reply.id} className="flex items-start gap-3">
                                  <Avatar className="h-7 w-7 border border-border">
                                    <AvatarImage src={reply.profile?.avatar_url} alt={replyName} />
                                    <AvatarFallback className="text-[10px]">{replyInitials}</AvatarFallback>
                                  </Avatar>

                                  <div className="min-w-0 flex-1 border-l border-border/60 pl-3">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-[12px] font-semibold">{replyName}</p>
                                      <span className="text-[11px] text-muted-foreground">{replyTimeLabel}</span>
                                    </div>
                                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                      Balasan
                                    </p>
                                    {replyContent.length > 0 && (
                                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                                        {reply.content}
                                      </p>
                                    )}
                                    {reply.image_url && (
                                      <div className="mt-2 w-fit max-w-[min(70vw,260px)] overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:max-w-[300px]">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCommentImageViewer({
                                              url: reply.image_url || '',
                                              alt: `Lampiran balasan ${replyName}`,
                                            })
                                          }
                                          className="inline-block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                        >
                                          <img
                                            src={reply.image_url}
                                            alt="Lampiran balasan"
                                            className="block h-auto max-h-[240px] w-auto max-w-full object-contain transition-transform duration-200 hover:scale-[1.01]"
                                            loading="lazy"
                                          />
                                        </button>
                                      </div>
                                    )}

                                    <div className="mt-1.5 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => handleReplyToComment(reply, replyName)}
                                          className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                                        >
                                          Balas
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleCommentLike(reply.id)}
                                          disabled={isTogglingCommentLike}
                                          className={cn(
                                            'inline-flex items-center gap-1 text-[11px] font-semibold transition-colors',
                                            reply.is_liked
                                              ? 'text-[#FF3B00] hover:text-[#FF3B00]'
                                              : 'text-muted-foreground hover:text-primary'
                                          )}
                                        >
                                          <Flame
                                            className={cn(
                                              'h-3.5 w-3.5',
                                              reply.is_liked && '[&>path]:fill-current [&>path]:stroke-current'
                                            )}
                                          />
                                          <span>{reply.likes_count && reply.likes_count > 0 ? reply.likes_count : 'Suka'}</span>
                                        </button>
                                      </div>

                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                          >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                          {isMyReply ? (
                                            <DropdownMenuItem
                                              disabled={isDeletingComment}
                                              onClick={() => handleDeleteComment(reply.id, reply.user_id)}
                                            >
                                              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                              Hapus komentar
                                            </DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setReportCommentReason(REPORT_REASONS[0]);
                                                setReportCommentTarget({ id: reply.id, userName: replyName });
                                                setIsReportCommentDialogOpen(true);
                                              }}
                                            >
                                              <Flag className="mr-2 h-4 w-4" />
                                              Laporkan komentar
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {hasMoreComments && (
                    <div className="pt-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void loadMoreComments()}
                        disabled={isLoadingMoreComments}
                        className="rounded-full px-4 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        {isLoadingMoreComments ? 'Memuat komentar...' : 'Lihat komentar lainnya'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border/80 bg-card px-4 pb-4 pt-3 sm:px-5">
              {replyTarget && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                  <span className="truncate text-muted-foreground">Membalas {replyTarget.name}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Batal
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSubmitComment}
                className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2"
              >
                <input
                  ref={commentImageInputRef}
                  type="file"
                  accept={UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={handleCommentImageSelect}
                  className="hidden"
                  disabled={isSubmittingComment}
                />
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={profile?.avatar_url} alt={viewerName} />
                  <AvatarFallback className="text-[10px]">{viewerInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={handleCommentInputKeyDown}
                    rows={1}
                    placeholder={replyTarget ? `Balas ${replyTarget.name}...` : 'Tulis komentar...'}
                    disabled={isSubmittingComment}
                    className="min-h-[40px] max-h-28 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0"
                  />
                  {commentImagePreviewUrl && (
                    <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/35 px-2 py-1">
                      <img
                        src={commentImagePreviewUrl}
                        alt="Preview gambar komentar"
                        className="h-10 w-10 rounded object-cover"
                      />
                      <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                        {commentImageFile?.name ?? 'Gambar siap dikirim'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={clearCommentImage}
                        disabled={isSubmittingComment}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">Enter kirim, Shift+Enter baris baru</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => commentImageInputRef.current?.click()}
                  disabled={isSubmittingComment}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmittingComment || !canSubmitComment}
                  className="h-9 rounded-xl px-3 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {isUploadingCommentImage ? 'Upload...' : isCommenting ? 'Kirim...' : 'Kirim'}
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(commentImageViewer)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCommentImageViewer(null);
          }
        }}
      >
        <DialogContent className="w-[min(96vw,980px)] max-h-[92vh] gap-0 overflow-hidden border-border/60 bg-black/95 p-0 [&>button]:text-white [&>button]:hover:bg-white/10">
          <DialogHeader className="sr-only">
            <DialogTitle>Pratinjau gambar komentar</DialogTitle>
            <DialogDescription>Lihat gambar komentar dalam ukuran penuh.</DialogDescription>
          </DialogHeader>
          {commentImageViewer && (
            <div className="flex items-center justify-center bg-black p-2 sm:p-4">
              <img
                src={commentImageViewer.url}
                alt={commentImageViewer.alt}
                className="max-h-[86vh] w-auto max-w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[560px] border-border bg-card">
          <DialogHeader>
            <DialogTitle>Edit Postingan</DialogTitle>
            <DialogDescription>Perbarui caption postingan Anda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={editCaption}
              onChange={(event) => setEditCaption(event.target.value)}
              maxLength={800}
              className="h-32 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
              placeholder="Tulis caption..."
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{editCaption.trim().length}/800</span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isUpdatingPost}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleEditPost}
                  disabled={isUpdatingPost || editCaption.trim() === ''}
                >
                  {isUpdatingPost ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[460px] border-border bg-card">
          <DialogHeader>
            <DialogTitle>Hapus Postingan?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak bisa dibatalkan. Postingan akan hilang dari beranda.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeletingPost}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePost}
              disabled={isDeletingPost}
            >
              {isDeletingPost ? 'Menghapus...' : 'Hapus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportPostDialogOpen} onOpenChange={setIsReportPostDialogOpen}>
        <DialogContent className="max-w-[520px] border-border bg-card">
          <DialogHeader>
            <DialogTitle>Laporkan Postingan</DialogTitle>
            <DialogDescription>Pilih alasan laporan untuk membantu moderasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportPostReason(reason)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    reportPostReason === reason
                      ? 'border-primary/45 bg-primary/10 text-primary'
                      : 'border-border bg-background/65 hover:bg-muted/45'
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsReportPostDialogOpen(false)}
                disabled={isReportingPost}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleReportPost}
                disabled={isReportingPost}
              >
                {isReportingPost ? 'Mengirim...' : 'Kirim Laporan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReportCommentDialogOpen}
        onOpenChange={(next) => {
          setIsReportCommentDialogOpen(next);
          if (!next) setReportCommentTarget(null);
        }}
      >
        <DialogContent className="max-w-[520px] border-border bg-card">
          <DialogHeader>
            <DialogTitle>Laporkan Komentar</DialogTitle>
            <DialogDescription>
              {reportCommentTarget
                ? `Pilih alasan laporan untuk komentar dari ${reportCommentTarget.userName}.`
                : 'Pilih alasan laporan komentar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportCommentReason(reason)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    reportCommentReason === reason
                      ? 'border-primary/45 bg-primary/10 text-primary'
                      : 'border-border bg-background/65 hover:bg-muted/45'
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsReportCommentDialogOpen(false)}
                disabled={isReportingComment}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleReportComment}
                disabled={isReportingComment || !reportCommentTarget}
              >
                {isReportingComment ? 'Mengirim...' : 'Kirim Laporan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  count,
  active = false,
  iconProps,
  iconAnimationKey,
  activeClassName,
  activeIconClassName,
  activeCountClassName,
  onClick,
  disabled = false,
}: {
  icon: ComponentType<Record<string, unknown>>;
  label: string;
  count?: number;
  active?: boolean;
  iconProps?: Record<string, unknown>;
  iconAnimationKey?: number;
  activeClassName?: string;
  activeIconClassName?: string;
  activeCountClassName?: string;
  onClick: (event: MouseEvent) => void;
  disabled?: boolean;
}) {
  const iconNode = (
    <Icon
      className={cn('h-4 w-4', active && activeIconClassName)}
      {...iconProps}
    />
  );

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-9 rounded-lg px-1.5 text-[11px] text-muted-foreground hover:bg-muted/55 hover:text-foreground sm:h-10 sm:rounded-xl sm:px-2 sm:text-xs',
        active && (activeClassName || 'text-primary')
      )}
    >
      {iconAnimationKey ? (
        <motion.span
          key={`like-icon-${iconAnimationKey}`}
          initial={{ scale: 1, rotate: 0 }}
          animate={{ scale: [1, 1.34, 1], rotate: [0, -10, 8, 0] }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          {iconNode}
        </motion.span>
      ) : (
        iconNode
      )}
      <span className="sr-only">{label}</span>
      {typeof count === 'number' && (
        <span className={cn('ml-1 tabular-nums', active && activeCountClassName)}>
          {count}
        </span>
      )}
    </Button>
  );
}
