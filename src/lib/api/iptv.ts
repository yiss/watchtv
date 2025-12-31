import { fetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';
import { Playlist, PlaylistItem, Category } from '@/types';

interface RustPlaylistItem {
  id: string;
  name: string;
  url: string;
  tvg_id: string | null;
  tvg_logo: string | null;
  group_title: string;
}

interface RustParsedPlaylist {
  items: RustPlaylistItem[];
  categories: string[];
}

interface CachedChannel {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  group_title: string | null;
  content_type: string;
  category_id: string | null;
  stream_id: string | null;
  container_extension: string | null;
}

interface CachedCategory {
  id: string;
  name: string;
  content_type: string;
}

// Check if playlist data is cached
export const isPlaylistCached = async (playlistId: string): Promise<boolean> => {
  try {
    return await invoke<boolean>('is_playlist_cached', { playlistId });
  } catch (error) {
    console.error('Error checking cache:', error);
    return false;
  }
};

// Get content availability from cache
export const getContentAvailability = async (playlistId: string): Promise<{ live: boolean; movie: boolean; series: boolean }> => {
  try {
    const result = await invoke<Record<string, boolean>>('get_content_availability', { playlistId });
    return {
      live: result.live || false,
      movie: result.movie || false,
      series: result.series || false,
    };
  } catch (error) {
    console.error('Error getting content availability:', error);
    return { live: false, movie: false, series: false };
  }
};

// Get cached categories
export const getCachedCategories = async (playlistId: string, contentType: 'live' | 'movie' | 'series'): Promise<Category[]> => {
  try {
    const categories = await invoke<CachedCategory[]>('get_cached_categories', { playlistId, contentType });
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      type: contentType,
    }));
  } catch (error) {
    console.error('Error getting cached categories:', error);
    return [];
  }
};

// Get cached channels
export const getCachedChannels = async (playlistId: string, categoryId: string | null, contentType: 'live' | 'movie' | 'series'): Promise<PlaylistItem[]> => {
  try {
    const channels = await invoke<CachedChannel[]>('get_cached_channels', { 
      playlistId, 
      categoryId, 
      contentType 
    });
    return channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      url: ch.url,
      tvgLogo: ch.logo || undefined,
      groupTitle: ch.group_title || 'Uncategorized',
    }));
  } catch (error) {
    console.error('Error getting cached channels:', error);
    return [];
  }
};

// Search cached channels
export const searchCachedChannels = async (
  playlistId: string, 
  query: string, 
  contentType?: 'live' | 'movie' | 'series',
  limit?: number
): Promise<PlaylistItem[]> => {
  try {
    const channels = await invoke<CachedChannel[]>('search_cached_channels', { 
      playlistId, 
      query, 
      contentType, 
      limit 
    });
    return channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      url: ch.url,
      tvgLogo: ch.logo || undefined,
      groupTitle: ch.group_title || 'Uncategorized',
    }));
  } catch (error) {
    console.error('Error searching cached channels:', error);
    return [];
  }
};

// Clear playlist cache
export const clearPlaylistCache = async (playlistId: string): Promise<void> => {
  try {
    await invoke('clear_playlist_cache', { playlistId });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Cache playlist data
export const cachePlaylistData = async (
  playlistId: string,
  categories: { id: string; name: string; content_type: string }[],
  channels: CachedChannel[]
): Promise<void> => {
  try {
    await invoke('cache_playlist_data', { playlistId, categories, channels });
    console.log('Playlist data cached successfully');
  } catch (error) {
    console.error('Error caching playlist data:', error);
  }
};

export const fetchM3UPlaylist = async (url: string): Promise<PlaylistItem[]> => {
  try {
    console.log('Fetching M3U playlist via Rust from:', url);
    
    // Use Rust command for faster parsing
    const result = await invoke<RustParsedPlaylist>('fetch_and_parse_m3u', { url });
    
    console.log('Rust parsed items count:', result.items?.length || 0);
    
    if (!result.items || result.items.length === 0) {
      console.warn('No items found in parsed playlist');
      return [];
    }
    
    return result.items.map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      tvgId: item.tvg_id || undefined,
      tvgLogo: item.tvg_logo || undefined,
      groupTitle: item.group_title || 'Uncategorized',
    }));
  } catch (error) {
    console.error('Error fetching M3U playlist:', error);
    throw error;
  }
};

export const fetchXtreamCategories = async (playlist: Playlist, type: 'live' | 'movie' | 'series', useCache = true): Promise<Category[]> => {
  // Try to get from cache first
  if (useCache && playlist.id) {
    const cached = await getCachedCategories(playlist.id, type);
    if (cached.length > 0) {
      console.log(`Using cached categories for ${type}`);
      return cached;
    }
  }
  
  const { serverUrl, username, password } = playlist;
  let action = '';
  if (type === 'live') action = 'get_live_categories';
  if (type === 'movie') action = 'get_vod_categories';
  if (type === 'series') action = 'get_series_categories';

  const url = `${serverUrl}/player_api.php?username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&action=${action}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'WatchTV/1.0',
    },
    connectTimeout: 30000,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();

  return data.map((cat: any) => ({
    id: cat.category_id,
    name: cat.category_name,
    type,
  }));
};

export const fetchXtreamItems = async (playlist: Playlist, type: 'live' | 'movie' | 'series', categoryId?: string, useCache = true): Promise<PlaylistItem[]> => {
  // Try to get from cache first
  if (useCache && playlist.id) {
    const cached = await getCachedChannels(playlist.id, categoryId || null, type);
    if (cached.length > 0) {
      console.log(`Using cached channels for ${type} category ${categoryId || 'all'}`);
      return cached;
    }
  }
  
  const { serverUrl, username, password } = playlist;
  let action = '';
  if (type === 'live') action = 'get_live_streams';
  if (type === 'movie') action = 'get_vod_streams';
  if (type === 'series') action = 'get_series';

  let url = `${serverUrl}/player_api.php?username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&action=${action}`;
  if (categoryId) {
    url += `&category_id=${encodeURIComponent(categoryId)}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'WatchTV/1.0',
    },
    connectTimeout: 30000,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();

  return data.map((item: any) => {
    let streamUrl = '';
    const id = item.stream_id || item.series_id || item.movie_id;
    if (type === 'live') streamUrl = `${serverUrl}/live/${username}/${password}/${id}.ts`;
    if (type === 'movie') streamUrl = `${serverUrl}/movie/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;
    if (type === 'series') streamUrl = `${serverUrl}/series/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;

    return {
      id: String(id),
      name: item.name || item.title,
      url: streamUrl,
      tvgLogo: item.stream_icon || item.cover,
      groupTitle: item.category_id,
    };
  });
};

// Fetch and cache all playlist data (call once when loading a playlist)
export const fetchAndCacheXtreamPlaylist = async (playlist: Playlist): Promise<void> => {
  if (!playlist.id || playlist.type !== 'xtream') return;
  
  const { serverUrl, username, password } = playlist;
  const allCategories: { id: string; name: string; content_type: string }[] = [];
  const allChannels: CachedChannel[] = [];
  
  console.log('Fetching and caching entire playlist...');
  
  // Fetch all content types
  for (const contentType of ['live', 'movie', 'series'] as const) {
    try {
      // Fetch categories
      let action = '';
      if (contentType === 'live') action = 'get_live_categories';
      if (contentType === 'movie') action = 'get_vod_categories';
      if (contentType === 'series') action = 'get_series_categories';
      
      const catUrl = `${serverUrl}/player_api.php?username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&action=${action}`;
      const catResponse = await fetch(catUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'WatchTV/1.0' },
        connectTimeout: 30000,
      });
      
      if (catResponse.ok) {
        const catData = await catResponse.json();
        for (const cat of catData) {
          allCategories.push({
            id: String(cat.category_id),
            name: cat.category_name,
            content_type: contentType,
          });
        }
      }
      
      // Fetch all streams
      let streamAction = '';
      if (contentType === 'live') streamAction = 'get_live_streams';
      if (contentType === 'movie') streamAction = 'get_vod_streams';
      if (contentType === 'series') streamAction = 'get_series';
      
      const streamUrl = `${serverUrl}/player_api.php?username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}&action=${streamAction}`;
      const streamResponse = await fetch(streamUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'WatchTV/1.0' },
        connectTimeout: 60000, // Longer timeout for full list
      });
      
      if (streamResponse.ok) {
        const streamData = await streamResponse.json();
        for (const item of streamData) {
          const id = item.stream_id || item.series_id || item.movie_id;
          let url = '';
          if (contentType === 'live') url = `${serverUrl}/live/${username}/${password}/${id}.ts`;
          if (contentType === 'movie') url = `${serverUrl}/movie/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;
          if (contentType === 'series') url = `${serverUrl}/series/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;
          
          allChannels.push({
            id: String(id),
            name: item.name || item.title,
            url,
            logo: item.stream_icon || item.cover || null,
            group_title: item.category_id ? String(item.category_id) : null,
            content_type: contentType,
            category_id: item.category_id ? String(item.category_id) : null,
            stream_id: id ? String(id) : null,
            container_extension: item.container_extension || null,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching ${contentType} data:`, error);
    }
  }
  
  // Cache all data
  if (allCategories.length > 0 || allChannels.length > 0) {
    await cachePlaylistData(playlist.id, allCategories, allChannels);
    console.log(`Cached ${allCategories.length} categories and ${allChannels.length} channels`);
  }
};
