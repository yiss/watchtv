import { Playlist } from "@/types";

const PLAYLISTS_KEY = "watchtv_playlists";
const LAST_VIEWED_KEY = "watchtv_last_viewed";

export interface LastViewed {
  playlistId: string;
  channelId?: string;
  channelUrl?: string;
  channelName?: string;
  categoryId?: string;
  contentType?: 'live' | 'movie' | 'series';
}

export const getLastViewed = (): LastViewed | null => {
  const data = localStorage.getItem(LAST_VIEWED_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const saveLastViewed = (lastViewed: LastViewed) => {
  localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(lastViewed));
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
