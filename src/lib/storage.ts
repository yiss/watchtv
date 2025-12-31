import { Playlist } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const PLAYLISTS_KEY = "watchtv_playlists";
const LAST_VIEWED_KEY = "watchtv_last_viewed";
const OFFLINE_ITEMS_KEY = "watchtv_offline_items";

export interface OfflineItem {
  id: string;
  name: string;
  type: 'movie' | 'series';
  localPath: string;
  originalUrl: string;
  thumbnail?: string;
  downloadedAt: number;
  size?: number; // in bytes
  duration?: number; // in seconds
}

export interface LastViewed {
  playlistId: string;
  channelId?: string;
  channelUrl?: string;
  channelName?: string;
  categoryId?: string;
  contentType?: 'live' | 'movie' | 'series';
}

// Sync version for quick checks (uses localStorage as cache)
export const getLastViewed = (): LastViewed | null => {
  const data = localStorage.getItem(LAST_VIEWED_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// Async version that also saves to database
export const getLastViewedAsync = async (): Promise<LastViewed | null> => {
  try {
    const dbState = await invoke<{
      playlist_id: string;
      channel_id: string | null;
      category_id: string | null;
      content_type: string;
    } | null>('get_last_viewed_state');
    
    if (dbState) {
      // Also update localStorage as cache
      const lastViewed: LastViewed = {
        playlistId: dbState.playlist_id,
        channelId: dbState.channel_id || undefined,
        categoryId: dbState.category_id || undefined,
        contentType: dbState.content_type as 'live' | 'movie' | 'series',
      };
      localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(lastViewed));
      return lastViewed;
    }
    return null;
  } catch (error) {
    console.error('Error getting last viewed from DB:', error);
    // Fall back to localStorage
    return getLastViewed();
  }
};

export const saveLastViewed = (lastViewed: LastViewed) => {
  // Save to localStorage for quick access
  localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(lastViewed));
  
  // Also save to database for persistence across app restarts
  invoke('save_last_viewed_state', {
    playlistId: lastViewed.playlistId,
    channelId: lastViewed.channelId || null,
    categoryId: lastViewed.categoryId || null,
    contentType: lastViewed.contentType || 'live',
  }).catch((error) => {
    console.error('Error saving last viewed to DB:', error);
  });
};

export const clearLastViewed = () => {
  localStorage.removeItem(LAST_VIEWED_KEY);
};

export const getPlaylists = (): Playlist[] => {
  const data = localStorage.getItem(PLAYLISTS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const savePlaylist = (playlist: Playlist) => {
  const playlists = getPlaylists();
  const existingIndex = playlists.findIndex((p) => p.id === playlist.id);
  if (existingIndex > -1) {
    playlists[existingIndex] = playlist;
  } else {
    playlists.push(playlist);
  }
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
};

export const deletePlaylist = (id: string) => {
  const playlists = getPlaylists().filter((p) => p.id !== id);
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
};

export const savePlaylists = (playlists: Playlist[]) => {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
};

// Offline items management
export const getOfflineItems = (): OfflineItem[] => {
  const data = localStorage.getItem(OFFLINE_ITEMS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveOfflineItem = (item: OfflineItem) => {
  const items = getOfflineItems();
  const existingIndex = items.findIndex((i) => i.id === item.id);
  if (existingIndex > -1) {
    items[existingIndex] = item;
  } else {
    items.push(item);
  }
  localStorage.setItem(OFFLINE_ITEMS_KEY, JSON.stringify(items));
};

export const deleteOfflineItem = (id: string) => {
  const items = getOfflineItems().filter((i) => i.id !== id);
  localStorage.setItem(OFFLINE_ITEMS_KEY, JSON.stringify(items));
};

export const isItemDownloaded = (id: string): boolean => {
  return getOfflineItems().some((i) => i.id === id);
};
