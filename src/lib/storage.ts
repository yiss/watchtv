import { Playlist } from "@/types";

const PLAYLISTS_KEY = "watchtv_playlists";

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
