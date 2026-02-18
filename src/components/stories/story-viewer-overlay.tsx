// Story Viewer Overlay

'use client';

import { useMemo } from 'react';
import { StoryViewer } from './story-viewer';
import { useStories } from '@/lib/features/stories/use-stories';
import { useUIStore } from '@/lib/store/ui-store';
import type { Story } from '@/lib/types';

function sortStoriesByCreatedAt(stories: Story[]) {
  return [...stories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function StoryViewerOverlay() {
  const { data: stories = [] } = useStories();
  const { isStoryViewerOpen, storyViewerStoryId } = useUIStore();

  const viewerState = useMemo(() => {
    if (!isStoryViewerOpen || !storyViewerStoryId || stories.length === 0) return null;

    const activeStory = stories.find((story) => story.id === storyViewerStoryId);
    if (!activeStory) return null;

    const userStories = stories.filter((story) => story.user_id === activeStory.user_id);
    const sortedStories = sortStoriesByCreatedAt(userStories.length > 0 ? userStories : stories);
    const startIndex = Math.max(
      0,
      sortedStories.findIndex((story) => story.id === storyViewerStoryId)
    );

    return {
      stories: sortedStories,
      startIndex,
    };
  }, [isStoryViewerOpen, stories, storyViewerStoryId]);

  if (!viewerState) return null;

  return (
    <StoryViewer
      key={viewerState.stories[viewerState.startIndex]?.id || viewerState.startIndex}
      stories={viewerState.stories}
      startIndex={viewerState.startIndex}
    />
  );
}
