// Story Rail Component (Instagram-style)

'use client';

import { useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useCreateStory,
  useStories,
  useUserStories,
  useViewedStoryIds,
} from '@/lib/features/stories/use-stories';
import { StoriesService } from '@/lib/features/stories/stories-service';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { Play, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { Story } from '@/lib/types';

type TextStoryTheme = {
  id: string;
  from: string;
  to: string;
};

type TextStoryRenderOptions = {
  position: {
    x: number;
    y: number;
  };
  textColor: string;
  withBackground: boolean;
};

const TEXT_STORY_THEMES: TextStoryTheme[] = [
  { id: 'rose', from: '#FF0072', to: '#9B60F5' },
  { id: 'sky', from: '#3EA6FF', to: '#1F3A8A' },
  { id: 'emerald', from: '#10B981', to: '#0F766E' },
  { id: 'sunset', from: '#F97316', to: '#DC2626' },
];

const TEXT_STORY_TEXT_COLORS = [
  '#FFFFFF',
  '#FDE047',
  '#22D3EE',
  '#F472B6',
  '#111827',
];

function wrapTextByWidth(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 8);
}

async function buildTextStoryImageBlob(
  content: string,
  theme: TextStoryTheme,
  options: TextStoryRenderOptions
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Gagal membuat canvas story');
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, theme.from);
  gradient.addColorStop(1, theme.to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(0, 0, 0, 0.24)';
  context.fillRect(0, canvas.height - 360, canvas.width, 360);

  context.font = '700 76px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0, 0, 0, 0.42)';
  context.shadowBlur = 24;
  context.fillStyle = options.textColor;

  const lines = wrapTextByWidth(context, content, 860);
  const lineHeight = 104;
  const textBlockHeight = lines.length * lineHeight;
  const centerX = canvas.width * options.position.x;
  const centerY = canvas.height * options.position.y;
  const startY = centerY - textBlockHeight / 2 + lineHeight / 2;
  const lineWidths = lines.map((line) => context.measureText(line).width);
  const maxLineWidth = lineWidths.length > 0 ? Math.max(...lineWidths) : 0;
  const textBoxWidth = Math.min(maxLineWidth + 120, canvas.width * 0.9);
  const textStartX = centerX - maxLineWidth / 2;

  if (options.withBackground && maxLineWidth > 0) {
    const textBoxX = centerX - textBoxWidth / 2;
    const textBoxY = startY - lineHeight / 2 - 36;
    const textBoxHeight = textBlockHeight + 72;
    const radius = 34;

    context.shadowBlur = 0;
    context.fillStyle = 'rgba(0, 0, 0, 0.36)';
    context.beginPath();
    context.moveTo(textBoxX + radius, textBoxY);
    context.arcTo(textBoxX + textBoxWidth, textBoxY, textBoxX + textBoxWidth, textBoxY + textBoxHeight, radius);
    context.arcTo(textBoxX + textBoxWidth, textBoxY + textBoxHeight, textBoxX, textBoxY + textBoxHeight, radius);
    context.arcTo(textBoxX, textBoxY + textBoxHeight, textBoxX, textBoxY, radius);
    context.arcTo(textBoxX, textBoxY, textBoxX + textBoxWidth, textBoxY, radius);
    context.closePath();
    context.fill();

    context.shadowColor = 'rgba(0, 0, 0, 0.42)';
    context.shadowBlur = 24;
    context.fillStyle = options.textColor;
  }

  lines.forEach((line, index) => {
    context.fillText(line, textStartX, startY + index * lineHeight);
  });

  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255, 255, 255, 0.88)';
  context.font = '600 34px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  context.fillText('MyCatholic Story', canvas.width / 2, canvas.height - 92);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Gagal menghasilkan gambar story teks');
  }

  return blob;
}

export function StoryRail() {
  const { user, profile } = useAuth();
  const { openStoryViewer } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textPreviewRef = useRef<HTMLDivElement>(null);
  const [optimisticViewedIds, setOptimisticViewedIds] = useState<Set<string>>(new Set());
  const [isMyStoryActionOpen, setIsMyStoryActionOpen] = useState(false);
  const [isTextStoryDialogOpen, setIsTextStoryDialogOpen] = useState(false);
  const [textStoryContent, setTextStoryContent] = useState('');
  const [textStoryThemeId, setTextStoryThemeId] = useState(TEXT_STORY_THEMES[0].id);
  const [textStoryColor, setTextStoryColor] = useState(TEXT_STORY_TEXT_COLORS[0]);
  const [textStoryWithBackground, setTextStoryWithBackground] = useState(true);
  const [textStoryPosition, setTextStoryPosition] = useState({ x: 0.5, y: 0.5 });
  const [isDraggingTextStory, setIsDraggingTextStory] = useState(false);
  const [isCreatingTextStory, setIsCreatingTextStory] = useState(false);
  const { mutateAsync: createStory, isPending: isCreatingStory } = useCreateStory();
  const storyCardSizeClass = 'aspect-[9/16] w-[120px] sm:w-[152px] lg:w-[180px]';

  // Get stories from followed users
  const { data: stories = [] } = useStories();
  const userStoriesData = useUserStories();

  // Combine and group stories by user
  const storiesByUser = new Map<string, Story[]>();
  const allUserIds = new Set<string>();

  const addStoryToUser = (story: Story) => {
    const userStories = storiesByUser.get(story.user_id) ?? [];
    if (!userStories.some((existing) => existing.id === story.id)) {
      userStories.push(story);
      storiesByUser.set(story.user_id, userStories);
    }
    allUserIds.add(story.user_id);
  };

  (stories || []).forEach((story) => {
    addStoryToUser(story);
  });

  // Add current user's stories
  if (user && userStoriesData.data) {
    userStoriesData.data.forEach((story) => {
      addStoryToUser(story);
    });
  }

  // Get latest story for each user
  const usersWithStories = Array.from(allUserIds)
    .map((userId) => ({
      userId,
      stories: storiesByUser.get(userId) || [],
      latestStory: (storiesByUser.get(userId) || [])[0],
    }))
    .filter((item) => item.stories.length > 0);

  const allVisibleStoryIds = useMemo(
    () =>
      usersWithStories
        .flatMap((item) => item.stories.map((story) => story.id))
        .filter(Boolean)
        .sort(),
    [usersWithStories]
  );

  const { data: viewedStoryIdsFromDb = new Set<string>() } = useViewedStoryIds(allVisibleStoryIds);

  const viewedStoryIds = useMemo(() => {
    return new Set<string>([
      ...Array.from(viewedStoryIdsFromDb),
      ...Array.from(optimisticViewedIds),
    ]);
  }, [optimisticViewedIds, viewedStoryIdsFromDb]);

  const ownLatestStory = useMemo(() => {
    if (!user?.id) return null;
    return usersWithStories.find((item) => item.userId === user.id)?.latestStory ?? null;
  }, [user?.id, usersWithStories]);
  const otherUsersStories = useMemo(
    () => usersWithStories.filter((item) => item.userId !== user?.id),
    [user?.id, usersWithStories]
  );

  const handleStoryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!user?.id) {
      toast.error('Anda harus login untuk membuat story');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 20MB');
      return;
    }

    try {
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      const mediaUrl = await StoriesService.uploadStoryMedia(user.id, file);
      const story = await createStory({ mediaUrl, mediaType });
      openStoryViewer(story.id);
    } catch (error) {
      console.error('Create story error:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal membuat story');
    }
  };

  const openUploadPicker = () => {
    if (isCreatingStory) return;
    fileInputRef.current?.click();
  };

  const openTextStoryDialog = () => {
    setIsMyStoryActionOpen(false);
    setTextStoryPosition({ x: 0.5, y: 0.5 });
    setTextStoryColor(TEXT_STORY_TEXT_COLORS[0]);
    setTextStoryWithBackground(true);
    setIsTextStoryDialogOpen(true);
  };

  const updateTextStoryPositionFromPointer = (clientX: number, clientY: number) => {
    const previewElement = textPreviewRef.current;
    if (!previewElement) return;

    const rect = previewElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    setTextStoryPosition({
      x: Math.min(0.85, Math.max(0.15, x)),
      y: Math.min(0.85, Math.max(0.15, y)),
    });
  };

  const handleCreateTextStory = async () => {
    const trimmed = textStoryContent.trim();
    if (!trimmed) {
      toast.error('Teks story tidak boleh kosong');
      return;
    }
    if (!user?.id) {
      toast.error('Anda harus login untuk membuat story');
      return;
    }

    const selectedTheme =
      TEXT_STORY_THEMES.find((theme) => theme.id === textStoryThemeId) ??
      TEXT_STORY_THEMES[0];

    setIsCreatingTextStory(true);
    try {
      const blob = await buildTextStoryImageBlob(trimmed, selectedTheme, {
        position: textStoryPosition,
        textColor: textStoryColor,
        withBackground: textStoryWithBackground,
      });
      const file = new File(
        [blob],
        `story-text-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );
      const mediaUrl = await StoriesService.uploadStoryMedia(user.id, file);
      const story = await createStory({
        mediaUrl,
        mediaType: 'image',
      });
      setIsTextStoryDialogOpen(false);
      setTextStoryContent('');
      openStoryViewer(story.id);
      toast.success('Story teks berhasil dibuat');
    } catch (error) {
      console.error('Create text story error:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal membuat story teks');
    } finally {
      setIsCreatingTextStory(false);
    }
  };

  const handleOwnCardClick = () => {
    if (ownLatestStory?.id) {
      setIsMyStoryActionOpen(true);
      return;
    }
    openUploadPicker();
  };

  const ownName = profile?.full_name?.trim() || 'Saya';
  const ownInitials =
    ownName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'US';
  const selectedTextStoryTheme =
    TEXT_STORY_THEMES.find((theme) => theme.id === textStoryThemeId) ??
    TEXT_STORY_THEMES[0];
  const previewText = textStoryContent.trim() || 'Tulis teks story...';

  return (
    <div className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-2 pr-1 lg:gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleStoryUpload}
      />

      {/* Add Story Card */}
      <div
        className={cn(
          'group relative shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card text-left transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/35',
          storyCardSizeClass,
          (isCreatingStory || isCreatingTextStory) && 'opacity-70'
        )}
      >
        <button
          type="button"
          onClick={handleOwnCardClick}
          className="absolute inset-0 z-[1]"
          aria-label={ownLatestStory?.id ? 'Buka story saya' : 'Buat story'}
        />

        {ownLatestStory?.media_url ? (
          <>
            {ownLatestStory.media_type === 'video' ? (
              <video
                className="h-full w-full object-cover"
                src={ownLatestStory.media_url}
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={ownLatestStory.media_url}
                alt="My Story"
                className="h-full w-full object-cover"
              />
            )}
          </>
        ) : (
          <div className="h-full w-full bg-muted/40" />
        )}

        <div className="absolute left-2.5 top-2.5 z-10 rounded-full bg-primary p-[2px]">
          <Avatar className="h-8 w-8 border border-black/55 sm:h-9 sm:w-9">
            <AvatarImage src={profile?.avatar_url} alt={ownName} />
            <AvatarFallback>{ownInitials}</AvatarFallback>
          </Avatar>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/95 to-card/20" />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openUploadPicker();
          }}
          className="absolute left-1/2 top-[70%] z-20 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(31,93,140,0.45)]"
          aria-label="Upload story baru"
        >
          <Plus className="h-5 w-5" />
        </button>

        <span className="absolute inset-x-0 bottom-3 z-10 text-center text-sm font-semibold text-foreground">
          {isCreatingStory ? 'Upload...' : 'Create story'}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openTextStoryDialog();
          }}
          className="absolute right-2.5 top-2.5 z-20 rounded-lg border border-border/70 bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/65"
          aria-label="Buat story teks"
        >
          Aa
        </button>
      </div>

      {ownLatestStory?.id && (
        <Dialog open={isMyStoryActionOpen} onOpenChange={setIsMyStoryActionOpen}>
          <DialogContent className="max-w-[320px] border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>Cerita Saya</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMyStoryActionOpen(false);
                  openStoryViewer(ownLatestStory.id);
                }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/45"
              >
                Lihat Story
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMyStoryActionOpen(false);
                  openUploadPicker();
                }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/45"
              >
                Tambah Story Baru
              </button>
              <button
                type="button"
                onClick={openTextStoryDialog}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/45"
              >
                Buat Story Teks
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={isTextStoryDialogOpen}
        onOpenChange={(open) => {
          setIsTextStoryDialogOpen(open);
          if (!open) setIsDraggingTextStory(false);
        }}
      >
        <DialogContent className="max-w-[560px] border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Buat Story Teks</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="mx-auto w-[220px]">
                <div
                  ref={textPreviewRef}
                  className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-border"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${selectedTextStoryTheme.from}, ${selectedTextStoryTheme.to})`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setIsDraggingTextStory(true);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      updateTextStoryPositionFromPointer(event.clientX, event.clientY);
                    }}
                    onPointerMove={(event) => {
                      if (!isDraggingTextStory) return;
                      updateTextStoryPositionFromPointer(event.clientX, event.clientY);
                    }}
                    onPointerUp={() => setIsDraggingTextStory(false)}
                    onPointerCancel={() => setIsDraggingTextStory(false)}
                    onPointerLeave={() => setIsDraggingTextStory(false)}
                    className={cn(
                      'absolute z-10 max-w-[82%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words px-3 py-2 text-center text-sm font-semibold leading-snug shadow-[0_6px_18px_rgba(0,0,0,0.35)]',
                      textStoryWithBackground ? 'rounded-xl bg-black/45' : 'bg-transparent',
                      isDraggingTextStory ? 'cursor-grabbing' : 'cursor-grab'
                    )}
                    style={{
                      left: `${textStoryPosition.x * 100}%`,
                      top: `${textStoryPosition.y * 100}%`,
                      color: textStoryColor,
                    }}
                    aria-label="Geser posisi teks story"
                  >
                    {previewText}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Geser teks langsung di preview.
                </p>
              </div>

              <div className="space-y-3">
                <textarea
                  value={textStoryContent}
                  onChange={(event) => setTextStoryContent(event.target.value)}
                  placeholder="Tulis teks story kamu..."
                  maxLength={280}
                  className="h-28 w-full resize-none rounded-xl border border-border bg-background/75 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
                />

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Tema warna</p>
                  <p className="text-xs text-muted-foreground">{textStoryContent.length}/280</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {TEXT_STORY_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setTextStoryThemeId(theme.id)}
                      className={cn(
                        'h-8 w-8 rounded-full border transition-all',
                        textStoryThemeId === theme.id ? 'border-foreground scale-110' : 'border-border hover:border-muted-foreground'
                      )}
                      style={{ backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
                      aria-label={`Pilih tema ${theme.id}`}
                    />
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">Warna teks</p>
                <div className="flex flex-wrap gap-2">
                  {TEXT_STORY_TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTextStoryColor(color)}
                      className={cn(
                        'h-8 w-8 rounded-full border transition-all',
                        textStoryColor === color ? 'border-foreground scale-110' : 'border-border hover:border-muted-foreground'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Pilih warna ${color}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2">
                  <p className="text-sm text-muted-foreground">Background teks</p>
                  <Switch
                    checked={textStoryWithBackground}
                    onCheckedChange={(checked) => setTextStoryWithBackground(Boolean(checked))}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setTextStoryPosition({ x: 0.5, y: 0.5 })}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/45"
                >
                  Reset Posisi Teks
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateTextStory}
              disabled={isCreatingTextStory || textStoryContent.trim().length === 0}
              className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingTextStory ? 'Membuat Story...' : 'Bagikan Story Teks'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Stories */}
      {otherUsersStories.map((item) => (
        <StoryRailItem
          key={item.userId}
          userName={item.latestStory?.profiles?.full_name || ''}
          avatarUrl={item.latestStory?.profiles?.avatar_url}
          stories={item.stories}
          latestStory={item.latestStory}
          viewerId={user?.id}
          cardSizeClass={storyCardSizeClass}
          viewedStoryIds={viewedStoryIds}
          onOpenStory={(storyId) => {
            const selectedStory = item.stories.find((story) => story.id === storyId);
            if (selectedStory && user?.id && selectedStory.user_id !== user.id) {
              setOptimisticViewedIds((previous) => {
                const next = new Set(previous);
                next.add(storyId);
                return next;
              });
            }
            openStoryViewer(storyId);
          }}
        />
      ))}

    </div>
  );
}

function StoryRailItem({
  userName,
  avatarUrl,
  stories,
  latestStory,
  viewerId,
  cardSizeClass,
  viewedStoryIds,
  onOpenStory,
}: {
  userName: string;
  avatarUrl?: string;
  stories: Story[];
  latestStory?: Story;
  viewerId?: string;
  cardSizeClass: string;
  viewedStoryIds: Set<string>;
  onOpenStory: (storyId: string) => void;
}) {
  const hasUnviewedStories = stories.filter((story) => {
    if (!story?.id) return false;
    if (viewerId && story.user_id === viewerId) return false;
    return !viewedStoryIds.has(story.id);
  }).length;
  const isViewed = hasUnviewedStories === 0;

  const initials = userName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'US';

  const handleClick = () => {
    if (!latestStory?.id) return;
    onOpenStory(latestStory.id);
  };
  const displayName = userName?.trim() || 'Umat';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group relative shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card text-left transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/35',
        cardSizeClass
      )}
    >
      {latestStory?.media_type === 'video' ? (
        <video
          className="h-full w-full object-cover"
          src={latestStory.media_url}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={latestStory?.media_url}
          alt={displayName}
          className="h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      <div
        className={cn(
          'absolute left-2.5 top-2.5 rounded-full p-[2px]',
          !isViewed && hasUnviewedStories > 0
            ? 'signature-gradient'
            : 'bg-border'
        )}
      >
        <Avatar className="h-8 w-8 border border-black/55 sm:h-9 sm:w-9">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>

      {latestStory?.media_type === 'video' && (
        <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
          <Play className="h-3.5 w-3.5 fill-current" />
        </div>
      )}

      <div className="absolute bottom-2.5 left-2.5 right-2.5">
        <p className="truncate text-base font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
          {displayName}
        </p>
      </div>
    </button>
  );
}
