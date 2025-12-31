import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import { DownloadToast } from '@/components/ui/download-toast'
import { Playlist, PlaylistItem, Category } from '@/types'
import { 
  getPlaylists, 
  saveLastViewed, 
  getLastViewedAsync, 
  deletePlaylist as deletePlaylistStorage,
  getOfflineItems, 
  saveOfflineItem, 
  deleteOfflineItem as deleteOfflineItemStorage, 
  isItemDownloaded,
  OfflineItem
} from '@/lib/storage'
import { 
  fetchM3UPlaylist, 
  fetchXtreamCategories, 
  fetchXtreamItems, 
  isPlaylistCached, 
  fetchAndCacheXtreamPlaylist,
  getContentAvailability
} from '@/lib/api/iptv'

export interface PlaylistState {
  playlist: Playlist | null
  allPlaylists: Playlist[]
  contentType: 'live' | 'movie' | 'series'
  categories: Category[]
  selectedCategory: string | null
  items: PlaylistItem[]
  selectedItem: PlaylistItem | null
  allM3UItems: PlaylistItem[]
  isLoading: boolean
  sidebarLoading: boolean
  loadError: string | null
  hasMovies: boolean
  hasSeries: boolean
  hasOffline: boolean
  offlineItems: OfflineItem[]
  downloadProgress: Record<string, number>
  downloadingIds: Set<string>
}

export interface PlaylistActions {
  loadPlaylist: (playlistId: string) => Promise<void>
  loadInitialData: (playlist: Playlist, lastCategoryId?: string, lastChannelId?: string, initialContentType?: 'live' | 'movie' | 'series') => Promise<void>
  setContentType: (type: 'live' | 'movie' | 'series') => void
  selectCategory: (categoryId: string) => Promise<void>
  selectItem: (item: PlaylistItem | null) => void
  backToCategories: () => void
  switchPlaylist: (id: string) => void
  deletePlaylist: (id: string) => void
  handleDownload: (item: PlaylistItem) => Promise<void>
  handleCancelDownload: (id: string) => Promise<void>
  handleDeleteOfflineItem: (item: OfflineItem) => Promise<void>
  refreshPlaylists: () => void
  isItemDownloadedFn: (id: string) => boolean
}

export function usePlaylistData(playlistId: string): [PlaylistState, PlaylistActions] {
  const navigate = useNavigate()
  const isInitialLoadRef = useRef(true)
  const downloadToastIds = useRef<Record<string, string | number>>({})
  const downloadNames = useRef<Record<string, string>>({}) // Track download names
  
  const [state, setState] = useState<PlaylistState>({
    playlist: null,
    allPlaylists: [],
    contentType: 'live',
    categories: [],
    selectedCategory: null,
    items: [],
    selectedItem: null,
    allM3UItems: [],
    isLoading: true,
    sidebarLoading: false,
    loadError: null,
    hasMovies: false,
    hasSeries: false,
    hasOffline: false,
    offlineItems: [],
    downloadProgress: {},
    downloadingIds: new Set(),
  })

  // Format bytes helper
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }, [])

  // Cancel download helper
  const cancelDownload = useCallback(async (id: string) => {
    try {
      await invoke('cancel_download', { id })
    } catch (error) {
      console.error('Cancel failed:', error)
    }
  }, [])

  // Listen for download progress events
  useEffect(() => {
    const unlisten = listen<{ 
      id: string
      progress: number
      status: string
      downloaded_bytes: number
      total_bytes: number | null
      speed: number | null
    }>('download-progress', (event) => {
      const { id, progress, status, downloaded_bytes, total_bytes, speed } = event.payload
      const name = downloadNames.current[id] || 'Unknown'
      
      if (status === 'completed') {
        setState(prev => {
          const next = new Set(prev.downloadingIds)
          next.delete(id)
          const newProgress = { ...prev.downloadProgress }
          delete newProgress[id]
          return { ...prev, downloadingIds: next, downloadProgress: newProgress }
        })
        if (downloadToastIds.current[id]) {
          toast.dismiss(downloadToastIds.current[id])
          delete downloadToastIds.current[id]
        }
        delete downloadNames.current[id]
        toast.success(`Downloaded: ${name}`, {
          description: `${formatBytes(downloaded_bytes)} saved to offline`,
        })
        const items = getOfflineItems()
        setState(prev => ({ ...prev, offlineItems: items, hasOffline: items.length > 0 }))
      } else if (status === 'error' || status === 'cancelled') {
        setState(prev => {
          const next = new Set(prev.downloadingIds)
          next.delete(id)
          const newProgress = { ...prev.downloadProgress }
          delete newProgress[id]
          return { ...prev, downloadingIds: next, downloadProgress: newProgress }
        })
        if (downloadToastIds.current[id]) {
          toast.dismiss(downloadToastIds.current[id])
          delete downloadToastIds.current[id]
        }
        delete downloadNames.current[id]
        if (status === 'error') {
          toast.error(`Download failed: ${name}`)
        } else {
          toast.info(`Download cancelled: ${name}`)
        }
      } else {
        setState(prev => ({ ...prev, downloadProgress: { ...prev.downloadProgress, [id]: progress } }))
        
        // Update toast with custom component
        if (downloadToastIds.current[id]) {
          toast.custom(
            (t) => (
              <DownloadToast
                name={name}
                progress={progress}
                downloadedBytes={downloaded_bytes}
                totalBytes={total_bytes}
                speed={speed}
                onCancel={() => {
                  cancelDownload(id)
                  toast.dismiss(t)
                }}
              />
            ),
            {
              id: downloadToastIds.current[id],
              duration: Infinity,
            }
          )
        }
      }
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [formatBytes, cancelDownload])

  // Load offline items on mount
  useEffect(() => {
    const items = getOfflineItems()
    setState(prev => ({ ...prev, offlineItems: items, hasOffline: items.length > 0 }))
  }, [])

  const loadInitialData = useCallback(async (
    p: Playlist, 
    lastCategoryId?: string, 
    lastChannelId?: string,
    initialContentType: 'live' | 'movie' | 'series' = 'live'
  ) => {
    setState(prev => ({ ...prev, isLoading: true, loadError: null }))
    
    try {
      if (p.type === 'm3u' && p.url) {
        const allItems = await fetchM3UPlaylist(p.url)
        
        if (allItems.length === 0) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            loadError: 'No channels found in playlist. The playlist may be empty or in an unsupported format.',
            hasMovies: false,
            hasSeries: false,
          }))
          return
        }
        
        const uniqueCategories = Array.from(new Set(allItems.map(i => i.groupTitle).filter(Boolean)))
        const cats = uniqueCategories.map(name => ({ id: name!, name: name!, type: 'live' as const }))
        
        const categoryToSelect = lastCategoryId && cats.some(c => c.id === lastCategoryId) 
          ? lastCategoryId 
          : cats[0]?.id
        
        let selectedItem: PlaylistItem | null = null
        let filteredItems: PlaylistItem[] = []
        
        if (categoryToSelect) {
          filteredItems = allItems.filter(i => i.groupTitle === categoryToSelect)
          if (lastChannelId) {
            selectedItem = filteredItems.find(i => i.id === lastChannelId) || null
          }
        }
        
        setState(prev => ({
          ...prev,
          allM3UItems: allItems,
          categories: cats,
          selectedCategory: categoryToSelect || null,
          items: filteredItems,
          selectedItem,
          hasMovies: false,
          hasSeries: false,
          isLoading: false,
        }))
      } else if (p.type === 'xtream') {
        const isCached = await isPlaylistCached(p.id)
        
        if (isCached) {
          const availability = await getContentAvailability(p.id)
          const cats = await fetchXtreamCategories(p, initialContentType)
          
          const categoryToSelect = lastCategoryId && cats.some(c => c.id === lastCategoryId) 
            ? lastCategoryId 
            : cats[0]?.id
          
          let selectedItem: PlaylistItem | null = null
          let fetchedItems: PlaylistItem[] = []
          
          if (categoryToSelect) {
            setState(prev => ({ ...prev, sidebarLoading: true }))
            fetchedItems = await fetchXtreamItems(p, initialContentType, categoryToSelect)
            if (lastChannelId) {
              selectedItem = fetchedItems.find(i => i.id === lastChannelId) || null
            }
          }
          
          setState(prev => ({
            ...prev,
            categories: cats,
            selectedCategory: categoryToSelect || null,
            items: fetchedItems,
            selectedItem,
            hasMovies: availability.movie,
            hasSeries: availability.series,
            isLoading: false,
            sidebarLoading: false,
          }))
        } else {
          fetchAndCacheXtreamPlaylist(p).catch(console.error)
          
          const [liveCats, movieCats, seriesCats] = await Promise.all([
            fetchXtreamCategories(p, 'live', false).catch(() => []),
            fetchXtreamCategories(p, 'movie', false).catch(() => []),
            fetchXtreamCategories(p, 'series', false).catch(() => []),
          ])
          
          const cats = initialContentType === 'live' ? liveCats : initialContentType === 'movie' ? movieCats : seriesCats
          
          setState(prev => ({
            ...prev,
            categories: cats,
            hasMovies: movieCats.length > 0,
            hasSeries: seriesCats.length > 0,
            isLoading: false,
          }))
          
          if (cats.length > 0) {
            await actions.selectCategory(cats[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load playlist', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        loadError: 'Failed to load playlist. Please check the URL and try again.' 
      }))
    }
  }, [])

  const loadPlaylist = useCallback(async (id: string) => {
    isInitialLoadRef.current = true
    
    const playlists = getPlaylists()
    const p = playlists.find((p) => p.id === id)
    
    if (p) {
      setState(prev => ({ ...prev, playlist: p, allPlaylists: playlists }))
      
      const lastViewed = await getLastViewedAsync()
      let restoreContentType: 'live' | 'movie' | 'series' = 'live'
      
      if (lastViewed && lastViewed.playlistId === p.id) {
        if (lastViewed.contentType) {
          restoreContentType = lastViewed.contentType
          setState(prev => ({ ...prev, contentType: restoreContentType }))
        }
      }
      
      await loadInitialData(p, lastViewed?.categoryId, lastViewed?.channelId, restoreContentType)
      saveLastViewed({ playlistId: p.id, contentType: restoreContentType })
      
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 100)
    } else {
      navigate({ to: '/' })
      isInitialLoadRef.current = false
    }
  }, [navigate, loadInitialData])

  const setContentType = useCallback((type: 'live' | 'movie' | 'series') => {
    if (isInitialLoadRef.current) return
    
    setState(prev => ({ ...prev, contentType: type }))
    
    if (state.playlist?.type === 'xtream') {
      setState(prev => ({ ...prev, sidebarLoading: true }))
      fetchXtreamCategories(state.playlist!, type)
        .then(cats => {
          setState(prev => ({ 
            ...prev, 
            categories: cats, 
            items: [], 
            selectedCategory: null, 
            sidebarLoading: false 
          }))
        })
        .catch(err => {
          console.error('Failed to fetch categories:', err)
          setState(prev => ({ ...prev, sidebarLoading: false }))
        })
    }
  }, [state.playlist])

  const selectCategory = useCallback(async (categoryId: string) => {
    setState(prev => ({ ...prev, selectedCategory: categoryId }))
    
    if (state.playlist?.type === 'm3u') {
      const filtered = state.allM3UItems.filter(i => i.groupTitle === categoryId)
      setState(prev => ({ ...prev, items: filtered }))
    } else if (state.playlist?.type === 'xtream') {
      try {
        setState(prev => ({ ...prev, sidebarLoading: true }))
        const fetchedItems = await fetchXtreamItems(state.playlist!, state.contentType, categoryId)
        setState(prev => ({ ...prev, items: fetchedItems, sidebarLoading: false }))
      } catch (error) {
        console.error('Failed to fetch items', error)
        setState(prev => ({ ...prev, sidebarLoading: false }))
      }
    }
  }, [state.playlist, state.allM3UItems, state.contentType])

  const selectItem = useCallback((item: PlaylistItem | null) => {
    setState(prev => ({ ...prev, selectedItem: item }))
    
    if (item && state.playlist) {
      saveLastViewed({
        playlistId: state.playlist.id,
        channelId: item.id,
        channelUrl: item.url,
        channelName: item.name,
        categoryId: state.selectedCategory || undefined,
        contentType: state.contentType,
      })
    }
  }, [state.playlist, state.selectedCategory, state.contentType])

  const backToCategories = useCallback(() => {
    setState(prev => ({ ...prev, selectedCategory: null, items: [] }))
  }, [])

  const switchPlaylist = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedItem: null,
      selectedCategory: null,
      items: [],
      categories: [],
      allM3UItems: [],
      contentType: 'live',
      hasMovies: false,
      hasSeries: false,
      loadError: null,
    }))
    navigate({ to: '/playlist/$playlistId', params: { playlistId: id } })
  }, [navigate])

  const deletePlaylist = useCallback((id: string) => {
    deletePlaylistStorage(id)
    const updated = getPlaylists()
    setState(prev => ({ ...prev, allPlaylists: updated }))
    
    if (id === playlistId) {
      if (updated.length > 0) {
        navigate({ to: '/playlist/$playlistId', params: { playlistId: updated[0].id } })
      } else {
        navigate({ to: '/' })
      }
    }
  }, [playlistId, navigate])

  const handleDownload = useCallback(async (item: PlaylistItem) => {
    if (state.downloadingIds.has(item.id)) return
    
    setState(prev => ({
      ...prev,
      downloadingIds: new Set(prev.downloadingIds).add(item.id),
      downloadProgress: { ...prev.downloadProgress, [item.id]: 0 }
    }))
    
    // Store download name for toast
    downloadNames.current[item.id] = item.name
    
    // Show initial custom toast
    const toastId = toast.custom(
      (t) => (
        <DownloadToast
          name={item.name}
          progress={0}
          downloadedBytes={0}
          totalBytes={null}
          speed={null}
          onCancel={() => {
            cancelDownload(item.id)
            toast.dismiss(t)
          }}
        />
      ),
      { duration: Infinity }
    )
    downloadToastIds.current[item.id] = toastId
    
    try {
      const result = await invoke<{
        id: string
        name: string
        local_path: string
        original_url: string
        thumbnail: string | null
        downloaded_at: number
        size: number | null
      }>('download_video', {
        id: item.id,
        url: item.url,
        name: item.name,
        thumbnail: item.tvgLogo || null,
      })
      
      saveOfflineItem({
        id: result.id,
        name: result.name,
        type: state.contentType === 'movie' ? 'movie' : 'series',
        localPath: result.local_path,
        originalUrl: result.original_url,
        thumbnail: result.thumbnail || undefined,
        downloadedAt: result.downloaded_at * 1000,
        size: result.size || undefined,
      })
      
      const items = getOfflineItems()
      setState(prev => ({ ...prev, offlineItems: items, hasOffline: true }))
    } catch (error) {
      console.error('Download failed:', error)
      toast.error(`Download failed: ${error}`)
    }
  }, [state.downloadingIds, state.contentType, cancelDownload])

  // Use cancelDownload directly
  const handleCancelDownload = cancelDownload

  const handleDeleteOfflineItem = useCallback(async (item: OfflineItem) => {
    try {
      await invoke('delete_download', { path: item.localPath })
      deleteOfflineItemStorage(item.id)
      const items = getOfflineItems()
      setState(prev => ({ ...prev, offlineItems: items, hasOffline: items.length > 0 }))
    } catch (error) {
      console.error('Delete failed:', error)
      deleteOfflineItemStorage(item.id)
      const items = getOfflineItems()
      setState(prev => ({ ...prev, offlineItems: items, hasOffline: items.length > 0 }))
    }
  }, [])

  const refreshPlaylists = useCallback(() => {
    setState(prev => ({ ...prev, allPlaylists: getPlaylists() }))
  }, [])

  const isItemDownloadedFn = useCallback((id: string) => {
    return isItemDownloaded(id)
  }, [])

  const actions: PlaylistActions = {
    loadPlaylist,
    loadInitialData,
    setContentType,
    selectCategory,
    selectItem,
    backToCategories,
    switchPlaylist,
    deletePlaylist,
    handleDownload,
    handleCancelDownload,
    handleDeleteOfflineItem,
    refreshPlaylists,
    isItemDownloadedFn,
  }

  return [state, actions]
}
