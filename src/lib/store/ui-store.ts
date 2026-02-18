// UI Store

import { create } from 'zustand';

interface UIState {
  // Modals
  isCreatePostOpen: boolean;
  isCreateStoryOpen: boolean;
  isNotificationsOpen: boolean;
  isSearchOpen: boolean;
  
  // Active chat
  activeChatId: string | null;

  // Story viewer state
  isStoryViewerOpen: boolean;
  openStoryViewer: (storyId: string) => void;
  closeStoryViewer: () => void;
  storyViewerStoryId: string | null;

  // Actions
  openCreatePost: () => void;
  closeCreatePost: () => void;
  openCreateStory: () => void;
  closeCreateStory: () => void;
  openNotifications: () => void;
  closeNotifications: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setActiveChatId: (chatId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Modals
  isCreatePostOpen: false,
  isCreateStoryOpen: false,
  isNotificationsOpen: false,
  isSearchOpen: false,
  
  // Active chat
  activeChatId: null,
  
  // Story viewer
  isStoryViewerOpen: false,
  storyViewerStoryId: null,
  
  // Actions
  openCreatePost: () => set({ isCreatePostOpen: true }),
  closeCreatePost: () => set({ isCreatePostOpen: false }),
  openCreateStory: () => set({ isCreateStoryOpen: true }),
  closeCreateStory: () => set({ isCreateStoryOpen: false }),
  openNotifications: () => set({ isNotificationsOpen: true }),
  closeNotifications: () => set({ isNotificationsOpen: false }),
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  
  // Story viewer actions
  openStoryViewer: (storyId) => set({ storyViewerStoryId: storyId, isStoryViewerOpen: true }),
  closeStoryViewer: () => set({ storyViewerStoryId: null, isStoryViewerOpen: false }),
}));
