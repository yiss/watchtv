import { fetch } from '@tauri-apps/plugin-http';
import { parse } from 'iptv-playlist-parser';
import { Playlist, PlaylistItem, Category } from '@/types';

export const fetchM3UPlaylist = async (url: string): Promise<PlaylistItem[]> => {
  try {
    console.log('Fetching M3U playlist from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'WatchTV/1.0',
      },
      connectTimeout: 30000,
    });
    
    if (!response.ok) {
      console.error('HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.text();
    console.log('Response received, length:', data?.length || 0);
    
    if (!data || typeof data !== 'string') {
      console.error('Invalid response data:', typeof data);
      return [];
    }
    
    // Check if response looks like an M3U file
    const trimmedData = data.trim();
    if (!trimmedData.startsWith('#EXTM3U')) {
      console.error('Response does not appear to be a valid M3U file. First 200 chars:', trimmedData.substring(0, 200));
      return [];
    }
    
    const result = parse(trimmedData);
    console.log('Parsed items count:', result.items?.length || 0);
    
    if (!result.items || result.items.length === 0) {
      console.warn('No items found in parsed playlist');
      return [];
    }
    
    return result.items.map((item, index) => ({
      id: item.tvg?.id || `item-${index}`,
      name: item.name || `Channel ${index + 1}`,
      url: item.url,
      tvgId: item.tvg?.id,
      tvgLogo: item.tvg?.logo,
      groupTitle: item.group?.title || 'Uncategorized',
    }));
  } catch (error) {
    console.error('Error fetching M3U playlist:', error);
    throw error;
  }
};

export const fetchXtreamCategories = async (playlist: Playlist, type: 'live' | 'movie' | 'series'): Promise<Category[]> => {
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

export const fetchXtreamItems = async (playlist: Playlist, type: 'live' | 'movie' | 'series', categoryId?: string): Promise<PlaylistItem[]> => {
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
