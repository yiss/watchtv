export interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url?: string;
  username?: string;
  password?: string;
  serverUrl?: string;
  updatedAt: number;
}

export interface PlaylistItem {
  id: string;
  name: string;
  url: string;
  tvgId?: string;
  tvgLogo?: string;
  groupTitle?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'live' | 'movie' | 'series';
}
