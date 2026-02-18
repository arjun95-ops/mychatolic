// Story Viewer Component (Instagram-style with auto-advance)

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Send, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useMarkStoryViewed, useReactToStory, useReplyToStory } from '@/lib/features/stories/use-stories';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Story } from '@/lib/types';

// Story settings
const STORY_DURATION = 5000; // 5 seconds per story
const MAX_VIDEO_DURATION = 30000; // 30 seconds safety cap
const STORY_NAVIGATION = {
  KEY_ARROW_LEFT: 'ArrowLeft',
  KEY_ARROW_RIGHT: 'ArrowRight',
  KEY_ESCAPE: 'Escape',
  KEY_SPACE: 'Space',
};

interface StoryViewerProps {
  stories: Story[];
  startIndex?: number;
}

export function StoryViewer({ stories, startIndex = 0 }: StoryViewerProps) {
  const { user, profile } = useAuth();
  const { closeStoryViewer } = useUIStore();
  const { mutate: markStoryViewed } = useMarkStoryViewed();
  const { mutateAsync: reactToStory, isPending: isReacting } = useReactToStory();
  const { mutateAsync: replyToStory, isPending: isReplying } = useReplyToStory();

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(STORY_DURATION);
  const [replyText, setReplyText] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const goToIndex = useCallback((nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setIsPaused(false);
    setCurrentDuration(STORY_DURATION);
  }, []);

  // Auto-advance story timer
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only run timer if story exists and not paused
    if (!stories[currentIndex] || isPaused) {
      return;
    }

    // Auto-advance after STORY_DURATION
    timerRef.current = setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        goToIndex(currentIndex + 1);
      } else {
        // Close viewer when done
        closeStoryViewer();
      }
    }, currentDuration);

    return () => {
      // Cleanup timer on unmount or index change
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [goToIndex, currentDuration, currentIndex, stories, isPaused, closeStoryViewer]);

  useEffect(() => {
    const currentStory = stories[currentIndex];
    if (!currentStory?.id || !user?.id) return;
    if (currentStory.user_id === user.id) return;
    markStoryViewed(currentStory.id);
  }, [currentIndex, markStoryViewed, stories, user?.id]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      goToIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1);
    }
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => {
      const nextIsPaused = !prev;
      if (videoRef.current) {
        if (nextIsPaused) {
          videoRef.current.pause();
        } else {
          void videoRef.current.play().catch(() => undefined);
        }
      }
      return nextIsPaused;
    });
  };

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    closeStoryViewer();
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case STORY_NAVIGATION.KEY_ARROW_RIGHT:
        e.preventDefault();
        handleNext();
        break;
      case STORY_NAVIGATION.KEY_ARROW_LEFT:
        e.preventDefault();
        handlePrevious();
        break;
      case STORY_NAVIGATION.KEY_ESCAPE:
        e.preventDefault();
        handleClose();
        break;
      case STORY_NAVIGATION.KEY_SPACE:
        e.preventDefault();
        handlePauseResume();
        break;
    }
  }, [handleNext, handlePrevious, handlePauseResume, handleClose]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentStory = stories[currentIndex];

    if (!replyText.trim()) {
      toast.error('Masukkan pesan terlebih dahulu!');
      return;
    }
    if (!currentStory?.id) return;

    if (isReplying) return;

    try {
      await replyToStory({
        storyId: currentStory.id,
        content: replyText.trim(),
      });
      toast.success('Pesan terkirim!');
      setReplyText('');
    } catch (error) {
      console.error('Send reply error:', error);
      toast.error('Gagal mengirim pesan');
    }
  };

  const handleLike = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory?.id) return;

    try {
      await reactToStory({
        storyId: currentStory.id,
        reaction: 'like',
      });
      toast.success('Disukai story!');
    } catch (error) {
      console.error('Story reaction error:', error);
    }
  };

  const handleVideoMetadataLoaded = () => {
    const video = videoRef.current;
    if (!video) return;

    const durationMs = Math.round(video.duration * 1000);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      setCurrentDuration(STORY_DURATION);
      return;
    }

    setCurrentDuration(Math.min(Math.max(durationMs, STORY_DURATION), MAX_VIDEO_DURATION));
    if (isPaused) {
      video.pause();
    }
  };

  const handleVideoEnded = () => {
    if (currentIndex < stories.length - 1) {
      goToIndex(currentIndex + 1);
      return;
    }

    closeStoryViewer();
  };

  // Show loading state if stories not loaded
  if (!stories || stories.length === 0 || !stories[currentIndex]) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const story = stories[currentIndex];
  const initials = story?.profiles?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'US';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onKeyDown={handleKeyDown}
    >
      {/* Top Bar */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 to-black/95">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-muted/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-white text-sm font-medium">
            {profile?.full_name || user?.email || 'Anonymous'}
          </span>
          <span className="text-white/60 text-xs">•</span>
          <span className="text-white text-xs">
            {story?.profiles?.full_name}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-muted/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress Bars */}
      <div className="flex gap-1 px-4 bg-black/60">
        {stories.map((_, index) => (
          <Progress
            key={index}
            value={index === currentIndex ? 100 : 0}
            className={cn(
              "h-0.5 w-full transition-all duration-300",
              index === currentIndex && "bg-card",
              index < currentIndex && "bg-muted/80"
            )}
          />
        ))}
      </div>

      {/* Story Content */}
      <div className="relative flex-1">
        {story?.media_type === 'image' ? (
          // Image Story
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img
              src={story.media_url}
              alt={`Story by ${story.profiles?.full_name}`}
              className="max-w-3xl w-full h-full object-contain"
            />
          </div>
        ) : story?.media_type === 'video' ? (
          // Video Story
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              key={story.id}
              src={story.media_url}
              className="max-h-full w-full max-w-3xl object-contain"
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoMetadataLoaded}
              onEnded={handleVideoEnded}
            />
          </div>
        ) : (
          // Text/Default Story
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-white text-center p-12">
              <h2 className="text-3xl font-bold mb-4">
                {story?.caption || 'Story tanpa media'}
              </h2>
              <p className="text-white/80 max-w-lg mx-auto">
                Konten story ini tidak berupa gambar/video.
              </p>
              {story?.media_url && (
                <a
                  href={story.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm hover:bg-muted/60"
                >
                  Buka Lampiran
                </a>
              )}
            </div>
          </div>
        )}

        {/* Story Caption Overlay */}
        {story?.caption && (
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white text-sm shadow-lg bg-black/50 backdrop-blur-md p-4 rounded-lg">
              {story.caption}
            </p>
          </div>
        )}

        {/* Left Navigation */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/30 hover:bg-muted/60 transition-colors z-10"
          >
            <ChevronLeft className="h-8 w-8 text-white" />
          </button>
        )}

        {/* Right Navigation */}
        {currentIndex < stories.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/30 hover:bg-muted/60 transition-colors z-10"
          >
            <ChevronRight className="h-8 w-8 text-white" />
          </button>
        )}
      </div>

      {/* User Info Overlay */}
      <div className="absolute top-16 left-4 flex items-center gap-3">
        <Avatar className="h-10 w-10 border-2 border-border">
          <AvatarImage src={story?.profiles?.avatar_url} alt={story?.profiles?.full_name || ''} />
          <AvatarFallback className="bg-primary text-white font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-white font-semibold text-base">
            {story?.profiles?.full_name}
          </p>
          <p className="text-white/60 text-xs">
            {(story?.profiles?.verification_status === 'verified_catholic' ||
              story?.profiles?.verification_status === 'verified_pastoral') && (
              <span className="ml-2">✓ Verified</span>
            )}
          </p>
          <p className="text-white/80 text-xs">
            {new Date(story.created_at).toLocaleDateString('id-ID', { month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Reply Section */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-black/90 pt-4 border-t border-border">
        <form onSubmit={handleReply} className="flex items-center gap-2 px-4 max-w-2xl mx-auto">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-white text-xs">{profile?.full_name?.slice(0, 2) || 'ME'}</AvatarFallback>
          </Avatar>
          <Input
            placeholder="Balas pesan..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-1 border-border bg-muted/60 text-white placeholder:text-white/60 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="bg-primary text-white hover:bg-primary-hover transition-colors"
            disabled={isReplying || !replyText.trim()}
          >
            {isReplying ? (
              <Send className="h-5 w-5 animate-pulse" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>

      {/* Like Button */}
      <button
        type="button"
        onClick={handleLike}
        className="absolute top-16 right-4 z-10 h-12 w-12 rounded-full bg-black/30 text-white transition-colors hover:bg-muted/60 hover:text-destructive"
        disabled={isReacting}
      >
        <Heart className={cn('h-6 w-6', isReacting && 'animate-pulse')} />
      </button>
    </div>
  );
}
