import axios from 'axios';
import { parse } from 'iptv-playlist-parser';
import { Playlist, PlaylistItem, Category } from '@/types';

export const fetchM3UPlaylist = async (url: string): Promise<PlaylistItem[]> => {
  const response = await axios.get(url);
  const result = parse(response.data);
  return result.items.map((item, index) => ({
    id: item.tvg.id || `${index}`,
    name: item.name,
    url: item.url,
    tvgId: item.tvg.id,
    tvgLogo: item.tvg.logo,
    groupTitle: item.group.title,
  }));
};

export const fetchXtreamCategories = async (playlist: Playlist, type: 'live' | 'movie' | 'series'): Promise<Category[]> => {
  const { serverUrl, username, password } = playlist;
  let action = '';
  if (type === 'live') action = 'get_live_categories';
  if (type === 'movie') action = 'get_vod_categories';
  if (type === 'series') action = 'get_series_categories';

  const response = await axios.get(`${serverUrl}/player_api.php`, {
    params: { username, password, action }
  });

  return response.data.map((cat: any) => ({
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

  const response = await axios.get(`${serverUrl}/player_api.php`, {
    params: { username, password, action, category_id: categoryId }
  });

  return response.data.map((item: any) => {
    let url = '';
    const id = item.stream_id || item.series_id || item.movie_id;
    if (type === 'live') url = `${serverUrl}/live/${username}/${password}/${id}.ts`;
    if (type === 'movie') url = `${serverUrl}/movie/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;
    if (type === 'series') url = `${serverUrl}/series/${username}/${password}/${id}.${item.container_extension || 'mp4'}`;

    return {
      id: String(id),
      name: item.name || item.title,
      url,
      tvgLogo: item.stream_icon || item.cover,
      groupTitle: item.category_id,
    };
  });
};
