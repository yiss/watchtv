import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Tv, 
  Search, 
  ChevronRight, 
  ListVideo,
  Menu,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  Download,
  HardDrive,
  Film,
  CheckCircle2
} from 'lucide-react'
import { PieProgress } from '@/components/ui/download-toast'
import { toast } from 'sonner'
import { Playlist, PlaylistItem, Category } from '@/types'
import { getPlaylists, saveLastViewed, getLastViewedAsync, deletePlaylist, getOfflineItems, saveOfflineItem, deleteOfflineItem, isItemDownloaded, OfflineItem } from '@/lib/storage'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { 
  fetchM3UPlaylist, 
  fetchXtreamCategories, 
  fetchXtreamItems, 
  isPlaylistCached, 
  fetchAndCacheXtreamPlaylist,
  getContentAvailability
} from '@/lib/api/iptv'
import { Input } from '@/components/ui/input'
import { VideoPlayer } from '@/components/player/video-player'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { AddPlaylistModal } from '@/components/playlist/add-playlist-modal'
import { SpotlightSearch } from '@/components/search/spotlight-search'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export const Route = createFileRoute('/playlist/$playlistId')({
  component: PlaylistPage,
})

// Extract quality from channel name (e.g., "Channel Name (1080p)" -> "1080p")
function extractQuality(name: string): string | null {
  const match = name.match(/\((\d+p)\)/i)
  return match ? match[1] : null
}

function PlaylistPage() {
  const { playlistId } = Route.useParams()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([])
  const [contentType, setContentType] = useState<'live' | 'movie' | 'series'>('live')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [selectedItem, setSelectedItem] = useState<PlaylistItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [playlistMenuVisible, setPlaylistMenuVisible] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [hasMovies, setHasMovies] = useState(false)
  const [hasSeries, setHasSeries] = useState(false)
  const [hasOffline, setHasOffline] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'live' | 'movie' | 'series' | 'offline'>('live')
  
  // Tab refs for dynamic indicator positioning
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 })
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const playlistMenuRef = useRef<HTMLDivElement>(null)

  // All items for M3U (since M3U usually loads everything at once)
  const [allM3UItems, setAllM3UItems] = useState<PlaylistItem[]>([])

  // Offline/Download state
  const [offlineItems, setOfflineItems] = useState<OfflineItem[]>([])
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const downloadToastIds = useRef<Record<string, string | number>>({}) // Maps item id to toast id

  // Close sidebar
  const closeSidebar = useCallback(() => {
    setSidebarVisible(false)
  }, [])

  // Close playlist menu
  const closePlaylistMenu = useCallback(() => {
    setPlaylistMenuVisible(false)
  }, [])

  // Handle click outside sidebars to dismiss them
  const handleClickOutside = useCallback((event: MouseEvent) => {
    // Handle categories sidebar
    if (
      sidebarVisible && 
      sidebarRef.current && 
      !sidebarRef.current.contains(event.target as Node)
    ) {
      const menuButton = document.querySelector('[data-menu-toggle]')
      if (menuButton && menuButton.contains(event.target as Node)) {
        return
      }
      closeSidebar()
    }
    
    // Handle playlist menu
    if (
      playlistMenuVisible && 
      playlistMenuRef.current && 
      !playlistMenuRef.current.contains(event.target as Node)
    ) {
      const playlistButton = document.querySelector('[data-playlist-toggle]')
      if (playlistButton && playlistButton.contains(event.target as Node)) {
        return
      }
      closePlaylistMenu()
    }
  }, [sidebarVisible, playlistMenuVisible, closeSidebar, closePlaylistMenu])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  // Auto-dismiss unavailable message after 3 seconds
  useEffect(() => {
    if (unavailableMessage) {
      const timer = setTimeout(() => {
        setUnavailableMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [unavailableMessage])

  // Load offline items and check if any exist
  useEffect(() => {
    const items = getOfflineItems()
    setOfflineItems(items)
    setHasOffline(items.length > 0)
  }, [])

  // Update tab indicator position when active tab changes
  useLayoutEffect(() => {
    const activeTabEl = tabRefs.current[activeTab]
    const container = tabsContainerRef.current
    if (activeTabEl && container) {
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeTabEl.getBoundingClientRect()
      setTabIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      })
    }
  }, [activeTab])

  // Format bytes helper
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
      
      if (status === 'completed') {
        setDownloadingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setDownloadProgress(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        // Dismiss loading toast and show success
        if (downloadToastIds.current[id]) {
          toast.dismiss(downloadToastIds.current[id])
          delete downloadToastIds.current[id]
        }
        toast.success('Download complete', {
          description: `${formatBytes(downloaded_bytes)} saved to offline`,
        })
        // Refresh offline items
        const items = getOfflineItems()
        setOfflineItems(items)
        setHasOffline(items.length > 0)
      } else if (status === 'error' || status === 'cancelled') {
        setDownloadingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setDownloadProgress(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        // Dismiss toast
        if (downloadToastIds.current[id]) {
          toast.dismiss(downloadToastIds.current[id])
          delete downloadToastIds.current[id]
        }
        if (status === 'error') {
          toast.error('Download failed')
        }
      } else {
        setDownloadProgress(prev => ({ ...prev, [id]: progress }))
        // Update toast with progress
        const speedStr = speed ? ` • ${formatBytes(speed)}/s` : ''
        const sizeStr = total_bytes ? `${formatBytes(downloaded_bytes)} / ${formatBytes(total_bytes)}` : formatBytes(downloaded_bytes)
        if (downloadToastIds.current[id]) {
          toast.loading(`Downloading... ${Math.round(progress * 100)}%`, {
            id: downloadToastIds.current[id],
            description: `${sizeStr}${speedStr}`,
          })
        }
      }
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [formatBytes])

  // Download a video
  const handleDownload = useCallback(async (item: PlaylistItem) => {
    if (downloadingIds.has(item.id)) return
    
    setDownloadingIds(prev => new Set(prev).add(item.id))
    setDownloadProgress(prev => ({ ...prev, [item.id]: 0 }))
    
    // Show toast notification
    const toastId = toast.loading(`Downloading ${item.name}...`, {
      description: 'Starting download...',
    })
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
      
      // Save to local storage
      saveOfflineItem({
        id: result.id,
        name: result.name,
        type: contentType === 'movie' ? 'movie' : 'series',
        localPath: result.local_path,
        originalUrl: result.original_url,
        thumbnail: result.thumbnail || undefined,
        downloadedAt: result.downloaded_at * 1000,
        size: result.size || undefined,
      })
      
      // Refresh offline items
      const items = getOfflineItems()
      setOfflineItems(items)
      setHasOffline(true)
    } catch (error) {
      console.error('Download failed:', error)
      setUnavailableMessage(`Download failed: ${error}`)
    }
  }, [downloadingIds, contentType])

  // Cancel a download
  const handleCancelDownload = useCallback(async (id: string) => {
    try {
      await invoke('cancel_download', { id })
    } catch (error) {
      console.error('Cancel failed:', error)
    }
  }, [])

  // Delete a downloaded item
  const handleDeleteOfflineItem = useCallback(async (item: OfflineItem) => {
    try {
      await invoke('delete_download', { path: item.localPath })
      deleteOfflineItem(item.id)
      const items = getOfflineItems()
      setOfflineItems(items)
      setHasOffline(items.length > 0)
    } catch (error) {
      console.error('Delete failed:', error)
      // Still remove from storage even if file deletion fails
      deleteOfflineItem(item.id)
      const items = getOfflineItems()
      setOfflineItems(items)
      setHasOffline(items.length > 0)
    }
  }, [])

  useEffect(() => {
    const initPlaylist = async () => {
      const playlists = getPlaylists()
      setAllPlaylists(playlists)
      const p = playlists.find((p) => p.id === playlistId)
      if (p) {
        setPlaylist(p)
        
        // Check for last viewed state from database
        const lastViewed = await getLastViewedAsync()
        if (lastViewed && lastViewed.playlistId === p.id) {
          // Restore content type if it was saved
          if (lastViewed.contentType) {
            setContentType(lastViewed.contentType)
            setActiveTab(lastViewed.contentType)
          }
          // We'll restore category and channel after loading data
        }
        
        await loadInitialData(p, lastViewed?.categoryId, lastViewed?.channelId)
        
        // Save as last viewed
        saveLastViewed({ playlistId: p.id, contentType })
      } else {
        navigate({ to: '/' })
      }
    }
    
    initPlaylist()
  }, [playlistId])

  // Save last viewed when channel changes
  useEffect(() => {
    if (playlist && selectedItem) {
      saveLastViewed({
        playlistId: playlist.id,
        channelId: selectedItem.id,
        channelUrl: selectedItem.url,
        channelName: selectedItem.name,
        categoryId: selectedCategory || undefined,
        contentType,
      })
    }
  }, [selectedItem, playlist, selectedCategory, contentType])

  const loadInitialData = async (p: Playlist, lastCategoryId?: string, lastChannelId?: string) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      if (p.type === 'm3u' && p.url) {
        // M3U playlists only have live TV
        setHasMovies(false)
        setHasSeries(false)
        
        const allItems = await fetchM3UPlaylist(p.url)
        setAllM3UItems(allItems)
        
        if (allItems.length === 0) {
          setLoadError('No channels found in playlist. The playlist may be empty or in an unsupported format.')
          return
        }
        
        // Extract categories from M3U
        const uniqueCategories = Array.from(new Set(allItems.map(i => i.groupTitle).filter(Boolean)))
        const cats = uniqueCategories.map(name => ({ id: name!, name: name!, type: 'live' as const }))
        setCategories(cats)
        
        // Restore last category or select first
        const categoryToSelect = lastCategoryId && cats.some(c => c.id === lastCategoryId) 
          ? lastCategoryId 
          : cats[0]?.id
        
        if (categoryToSelect) {
          setSelectedCategory(categoryToSelect)
          const filtered = allItems.filter(i => i.groupTitle === categoryToSelect)
          setItems(filtered)
          
          // Restore last channel if available
          if (lastChannelId) {
            const lastChannel = filtered.find(i => i.id === lastChannelId)
            if (lastChannel) {
              setSelectedItem(lastChannel)
            }
          }
        }
      } else if (p.type === 'xtream') {
        // Check if data is already cached
        const isCached = await isPlaylistCached(p.id)
        
        if (isCached) {
          console.log('Using cached playlist data')
          // Get content availability from cache
          const availability = await getContentAvailability(p.id)
          setHasMovies(availability.movie)
          setHasSeries(availability.series)
          
          // Load categories from cache
          const cats = await fetchXtreamCategories(p, contentType)
          setCategories(cats)
          
          // Restore last category or select first
          const categoryToSelect = lastCategoryId && cats.some(c => c.id === lastCategoryId) 
            ? lastCategoryId 
            : cats[0]?.id
          
          if (categoryToSelect) {
            setSelectedCategory(categoryToSelect)
            setSidebarLoading(true)
            const fetchedItems = await fetchXtreamItems(p, contentType, categoryToSelect)
            setItems(fetchedItems)
            setSidebarLoading(false)
            
            // Restore last channel if available
            if (lastChannelId) {
              const lastChannel = fetchedItems.find(i => i.id === lastChannelId)
              if (lastChannel) {
                setSelectedItem(lastChannel)
              }
            }
          }
        } else {
          console.log('Fetching and caching playlist data...')
          // Fetch and cache all data in background
          fetchAndCacheXtreamPlaylist(p).catch(err => {
            console.error('Background cache failed:', err)
          })
          
          // Meanwhile, fetch just what we need
          const [liveCats, movieCats, seriesCats] = await Promise.all([
            fetchXtreamCategories(p, 'live', false).catch(() => []),
            fetchXtreamCategories(p, 'movie', false).catch(() => []),
            fetchXtreamCategories(p, 'series', false).catch(() => []),
          ])
          
          setHasMovies(movieCats.length > 0)
          setHasSeries(seriesCats.length > 0)
          
          // Load the current content type's categories
          const cats = contentType === 'live' ? liveCats : contentType === 'movie' ? movieCats : seriesCats
          setCategories(cats)
          if (cats.length > 0) {
            handleCategorySelect(cats[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load playlist', error)
      setLoadError('Failed to load playlist. Please check the URL and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle tab change with animation
  const handleTabChange = useCallback((newType: 'live' | 'movie' | 'series' | 'offline') => {
    if (newType === activeTab) return
    
    // Check availability
    if (newType === 'movie' && !hasMovies) {
      setUnavailableMessage('This playlist does not contain movies')
      return
    }
    if (newType === 'series' && !hasSeries) {
      setUnavailableMessage('This playlist does not contain series')
      return
    }
    if (newType === 'offline' && !hasOffline) {
      setUnavailableMessage('No offline content available. Download movies or series first.')
      return
    }
    
    // Reset playback when switching tabs
    setSelectedItem(null)
    setActiveTab(newType)
    
    // For offline tab, don't change contentType
    if (newType !== 'offline') {
      // Small delay for animation
      setTimeout(() => {
        setContentType(newType)
      }, 50)
    }
  }, [activeTab, hasMovies, hasSeries, hasOffline])

  // Reload categories when content type changes for Xtream
  useEffect(() => {
    if (playlist?.type === 'xtream') {
      setSidebarLoading(true)
      fetchXtreamCategories(playlist, contentType)
        .then(cats => {
          setCategories(cats)
          setItems([])
          setSelectedCategory(null)
        })
        .catch(err => {
          console.error('Failed to fetch categories:', err)
        })
        .finally(() => {
          setSidebarLoading(false)
        })
    }
  }, [contentType, playlist])

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId)
    if (playlist?.type === 'm3u') {
      const filtered = allM3UItems.filter(i => i.groupTitle === categoryId)
      setItems(filtered)
    } else if (playlist?.type === 'xtream') {
      try {
        setSidebarLoading(true)
        const fetchedItems = await fetchXtreamItems(playlist, contentType, categoryId)
        setItems(fetchedItems)
      } catch (error) {
        console.error('Failed to fetch items', error)
      } finally {
        setSidebarLoading(false)
      }
    }
  }

  // When showing items (after selecting category), filter by search
  // When showing categories (no category selected), filter categories by search
  const displayItems = useMemo(() => {
    if (selectedCategory) {
      if (!searchQuery) return items
      return items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    } else {
      if (!searchQuery) return categories
      return categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
  }, [selectedCategory, items, categories, searchQuery])

  const handleBackToCategories = () => {
    setSelectedCategory(null)
    setItems([])
    setSearchQuery('')
  }

  const handleSwitchPlaylist = (id: string) => {
    // Reset all state when switching playlists
    setSelectedItem(null)
    setSelectedCategory(null)
    setItems([])
    setCategories([])
    setAllM3UItems([])
    setContentType('live')
    setSearchQuery('')
    setHasMovies(false)
    setHasSeries(false)
    // hasOffline is managed separately based on downloaded items
    setUnavailableMessage(null)
    setLoadError(null)
    
    closePlaylistMenu()
    navigate({ to: '/playlist/$playlistId', params: { playlistId: id } })
  }

  const handleDeletePlaylist = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deletePlaylist(id)
    const updated = getPlaylists()
    setAllPlaylists(updated)
    
    // If we deleted the current playlist, navigate to another or home
    if (id === playlistId) {
      if (updated.length > 0) {
        navigate({ to: '/playlist/$playlistId', params: { playlistId: updated[0].id } })
      } else {
        navigate({ to: '/' })
      }
    }
  }

  const handleAddPlaylistSuccess = () => {
    setIsAddModalOpen(false)
    setAllPlaylists(getPlaylists())
  }

  const quality = selectedItem ? extractQuality(selectedItem.name) : null

  return (
    <div className="flex flex-col h-screen w-full bg-[oklch(0.145_0_0)] overflow-hidden">
      {/* Draggable title bar region for macOS */}
      <div data-tauri-drag-region className="h-8 flex-shrink-0 w-full select-none cursor-default" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      
      {/* Apple TV Style Top Navigation */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="flex items-center justify-center py-3 px-6 flex-shrink-0 z-20 relative -mt-8 pt-8"
      >
        <div className="flex items-center gap-3 bg-[oklch(0.18_0_0)] rounded-full px-2 py-1.5 border border-[oklch(1_0_0_/_0.08)] shadow-xl shadow-black/30">
          {/* Menu Toggle Icon - Categories/Channels */}
          <div 
            role="button"
            tabIndex={0}
            data-menu-toggle
            onClick={() => {
              if (sidebarVisible) {
                closeSidebar()
              } else {
                setSidebarVisible(true)
                if (playlistMenuVisible) closePlaylistMenu()
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && (sidebarVisible ? closeSidebar() : setSidebarVisible(true))}
            className={cn(
              "p-2.5 rounded-full transition-all duration-200 cursor-pointer select-none",
              sidebarVisible 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.08)]"
            )}
          >
            <Menu className="h-5 w-5" />
          </div>
          
          {/* Playlist Icon - Playlist Management */}
          <div 
            role="button"
            tabIndex={0}
            data-playlist-toggle
            onClick={() => {
              if (playlistMenuVisible) {
                closePlaylistMenu()
              } else {
                setPlaylistMenuVisible(true)
                if (sidebarVisible) closeSidebar()
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && (playlistMenuVisible ? closePlaylistMenu() : setPlaylistMenuVisible(true))}
            className={cn(
              "p-2.5 rounded-full transition-all duration-200 cursor-pointer select-none",
              playlistMenuVisible 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.08)]"
            )}
          >
            <ListVideo className="h-5 w-5" />
          </div>
          
          {/* Separator */}
          <div className="w-px h-6 bg-[oklch(1_0_0_/_0.1)]" />
          
          {/* Tab Container with animated indicator */}
          <div ref={tabsContainerRef} className="relative flex items-center rounded-full">
            {/* Animated Tab Indicator using Motion */}
            <motion.div 
              className="absolute top-0 bottom-0 bg-[oklch(0.985_0_0)] rounded-full shadow-md"
              initial={false}
              animate={{
                left: tabIndicator.left,
                width: tabIndicator.width,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35,
              }}
            />
            
            {/* TV Tab */}
            <div 
              ref={(el) => { tabRefs.current.live = el }}
              role="button"
              tabIndex={0}
              onClick={() => handleTabChange('live')}
              onKeyDown={(e) => e.key === 'Enter' && handleTabChange('live')}
              className={cn(
                "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer select-none",
                activeTab === 'live' 
                  ? "text-[oklch(0.145_0_0)]" 
                  : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)]"
              )}
            >
              TV
            </div>
            
            {/* Movies Tab */}
            <div 
              ref={(el) => { tabRefs.current.movie = el }}
              role="button"
              tabIndex={0}
              onClick={() => handleTabChange('movie')}
              onKeyDown={(e) => e.key === 'Enter' && handleTabChange('movie')}
              className={cn(
                "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer select-none",
                activeTab === 'movie' 
                  ? "text-[oklch(0.145_0_0)]" 
                  : !hasMovies
                    ? "text-[oklch(0.4_0_0)] cursor-not-allowed"
                    : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)]"
              )}
            >
              Movies
            </div>
            
            {/* Series Tab */}
            <div 
              ref={(el) => { tabRefs.current.series = el }}
              role="button"
              tabIndex={0}
              onClick={() => handleTabChange('series')}
              onKeyDown={(e) => e.key === 'Enter' && handleTabChange('series')}
              className={cn(
                "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer select-none",
                activeTab === 'series' 
                  ? "text-[oklch(0.145_0_0)]" 
                  : !hasSeries
                    ? "text-[oklch(0.4_0_0)] cursor-not-allowed"
                    : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)]"
              )}
            >
              Series
            </div>
            
            {/* Offline Tab */}
            <div 
              ref={(el) => { tabRefs.current.offline = el }}
              role="button"
              tabIndex={0}
              onClick={() => handleTabChange('offline')}
              onKeyDown={(e) => e.key === 'Enter' && handleTabChange('offline')}
              className={cn(
                "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer select-none",
                activeTab === 'offline' 
                  ? "text-[oklch(0.145_0_0)]" 
                  : !hasOffline
                    ? "text-[oklch(0.4_0_0)]"
                    : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)]"
              )}
            >
              Offline
            </div>
          </div>
          
          {/* Separator */}
          <div className="w-px h-6 bg-[oklch(1_0_0_/_0.1)]" />
          
          {/* Search Icon - Opens Spotlight Search */}
          <div 
            role="button"
            tabIndex={0}
            onClick={() => setSpotlightOpen(true)}
            onKeyDown={(e) => e.key === 'Enter' && setSpotlightOpen(true)}
            className="p-2.5 rounded-full transition-all duration-200 text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.08)] cursor-pointer select-none"
            title="Search (⌘K)"
          >
            <Search className="h-5 w-5" />
          </div>
        </div>
      </motion.nav>

      {/* Unavailable Content Message */}
      <AnimatePresence>
        {unavailableMessage && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-[oklch(0.205_0_0)] border border-[oklch(1_0_0_/_0.1)] rounded-xl px-5 py-3 shadow-xl backdrop-blur-xl flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-[oklch(0.708_0_0)]" />
              <span className="text-[oklch(0.985_0_0)] text-sm">{unavailableMessage}</span>
              <button 
                onClick={() => setUnavailableMessage(null)}
                className="ml-2 text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area - Relative container for overlay */}
      <div className="flex-1 relative overflow-hidden px-4 pb-4 pt-1">
        {/* Video Player - Full width and height, relative creates stacking context */}
        <div className="w-full h-full rounded-2xl overflow-hidden bg-black relative isolate">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-[oklch(0.556_0_0)]">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
                <p className="text-lg">Loading playlist...</p>
                <p className="text-sm mt-2 opacity-70">This may take a moment for large playlists</p>
              </div>
            </div>
          ) : loadError ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-[oklch(0.556_0_0)] max-w-md px-4">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[oklch(0.704_0.191_22.216)]" />
                <p className="text-lg text-[oklch(0.985_0_0)] mb-2">Failed to Load Playlist</p>
                <p className="text-sm opacity-70 mb-4">{loadError}</p>
                <button
                  onClick={() => playlist && loadInitialData(playlist)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[oklch(0.269_0_0)] hover:bg-[oklch(0.3_0_0)] text-[oklch(0.985_0_0)] text-sm transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            </div>
          ) : selectedItem ? (
            <VideoPlayer
              title={selectedItem.name}
              src={selectedItem.url}
              autoplay
              isLive={contentType === 'live'}
              channelInfo={{
                name: selectedItem.name,
                category: selectedItem.groupTitle,
                logo: selectedItem.tvgLogo,
                quality: quality || undefined,
              }}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-[oklch(0.556_0_0)]">
                <Tv className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a channel to start watching</p>
              </div>
            </div>
          )}
        </div>

        {/* Left Sidebar - Categories/Channels */}
        <AnimatePresence>
          {sidebarVisible && (
            <motion.div 
              ref={sidebarRef} 
              initial={{ x: -380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -380, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute top-1 left-2 bottom-4 w-[380px] z-30"
            >
              <div className="h-full flex flex-col bg-[oklch(0.145_0_0_/_0.9)] backdrop-blur-xl rounded-2xl border border-[oklch(1_0_0_/_0.1)] overflow-hidden">
              {/* Search Box */}
              <div className="p-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[oklch(0.556_0_0)]" />
                  <Input 
                    placeholder="Search" 
                    className="pl-9 h-9 bg-[oklch(0.269_0_0)] border-0 rounded-lg text-[oklch(0.985_0_0)] placeholder:text-[oklch(0.556_0_0)] focus-visible:ring-1 focus-visible:ring-[oklch(1_0_0_/_0.3)] text-sm" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Back Button (when viewing items) */}
              {selectedCategory && (
                <button
                  onClick={handleBackToCategories}
                  className="mx-3 mb-2 flex items-center gap-2 text-sm text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to categories
                </button>
              )}
              
              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {(isLoading || sidebarLoading) ? (
                  // Loading State
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <Loader2 className="h-8 w-8 text-[oklch(0.556_0_0)] animate-spin mb-3" />
                    <p className="text-[oklch(0.556_0_0)] text-sm">
                      {isLoading ? 'Loading playlist...' : 'Loading content...'}
                    </p>
                  </div>
                ) : loadError ? (
                  // Error State
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                    <AlertCircle className="h-8 w-8 text-[oklch(0.704_0.191_22.216)] mb-3" />
                    <p className="text-[oklch(0.556_0_0)] text-sm text-center">{loadError}</p>
                  </div>
                ) : (
                  <div className="px-2 pb-2 space-y-0.5">
                    {/* Offline Mode Content */}
                    {activeTab === 'offline' ? (
                      offlineItems.length > 0 ? (
                        offlineItems.map((item, index) => (
                          <div
                            key={item.id}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 animate-scale-in group",
                              selectedItem?.id === item.id 
                                ? "bg-[oklch(0.269_0_0)]" 
                                : "hover:bg-[oklch(0.269_0_0_/_0.5)]"
                            )}
                            style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
                          >
                            {/* Thumbnail */}
                            {item.thumbnail ? (
                              <img 
                                src={item.thumbnail} 
                                alt="" 
                                className="w-10 h-14 rounded object-cover bg-[oklch(1_0_0_/_0.1)] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-14 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0">
                                <Film className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setSelectedItem({
                                  id: item.id,
                                  name: item.name,
                                  url: `file://${item.localPath}`,
                                  groupTitle: 'Offline',
                                  tvgLogo: item.thumbnail,
                                })}
                                className="text-[oklch(0.985_0_0)] text-sm truncate block w-full text-left hover:text-[oklch(0.9_0_0)]"
                              >
                                {item.name}
                              </button>
                              <p className="text-[oklch(0.556_0_0)] text-xs mt-0.5">
                                {item.type === 'movie' ? 'Movie' : 'Series'} • {item.size ? `${(item.size / 1024 / 1024).toFixed(0)} MB` : 'Unknown size'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteOfflineItem(item)}
                              className="p-1.5 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.704_0.191_22.216)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-center">
                          <HardDrive className="h-10 w-10 text-[oklch(0.556_0_0)] mb-3 opacity-50" />
                          <p className="text-[oklch(0.556_0_0)] text-sm">No offline content</p>
                          <p className="text-[oklch(0.456_0_0)] text-xs mt-1">Download movies or series to watch offline</p>
                        </div>
                      )
                    ) : selectedCategory ? (
                      // Show Items (Channels/Movies/Series) with logos
                      (displayItems as PlaylistItem[]).map((item, index) => (
                        <div
                          key={item.id}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 animate-scale-in group",
                            selectedItem?.id === item.id 
                              ? "bg-[oklch(0.269_0_0)]" 
                              : "hover:bg-[oklch(0.269_0_0_/_0.5)] hover:translate-x-1"
                          )}
                          style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
                        >
                          {/* Channel/Movie Logo */}
                          {item.tvgLogo ? (
                            <img 
                              src={item.tvgLogo} 
                              alt="" 
                              className={cn(
                                "rounded object-contain bg-[oklch(1_0_0_/_0.1)] shrink-0",
                                contentType === 'live' ? "w-7 h-7" : "w-10 h-14 object-cover"
                              )}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className={cn(
                              "rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0",
                              contentType === 'live' ? "w-7 h-7" : "w-10 h-14"
                            )}>
                              {contentType === 'live' ? (
                                <Tv className="h-3.5 w-3.5 text-[oklch(0.556_0_0)]" />
                              ) : (
                                <Film className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="text-[oklch(0.985_0_0)] text-sm truncate flex-1 text-left"
                          >
                            {item.name}
                          </button>
                          
                          {/* Download button for movies/series */}
                          {(contentType === 'movie' || contentType === 'series') && (
                            downloadingIds.has(item.id) ? (
                              <div 
                                className="relative shrink-0 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCancelDownload(item.id)
                                }}
                                title="Click to cancel"
                              >
                                <PieProgress 
                                  progress={downloadProgress[item.id] || 0} 
                                  size={28}
                                />
                              </div>
                            ) : isItemDownloaded(item.id) ? (
                              <CheckCircle2 className="h-4 w-4 text-[oklch(0.7_0.2_145)] shrink-0" />
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownload(item)
                                }}
                                className="p-1.5 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )
                          )}
                          
                          {contentType === 'live' && (
                            <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                          )}
                        </div>
                      ))
                    ) : (
                      // Show Categories
                      (displayItems as Category[]).map((cat, index) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[oklch(0.269_0_0_/_0.5)] hover:translate-x-1 transition-all duration-200 text-left animate-scale-in"
                          style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
                        >
                          <span className="text-[oklch(0.985_0_0)] text-sm truncate flex-1">
                            {cat.name}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Playlist Management Sidebar */}
        <AnimatePresence>
          {playlistMenuVisible && (
            <motion.div 
              ref={playlistMenuRef} 
              initial={{ x: -380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -380, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute top-1 left-2 bottom-4 w-[380px] z-30"
            >
              <div className="h-full flex flex-col bg-[oklch(0.145_0_0_/_0.9)] backdrop-blur-xl rounded-2xl border border-[oklch(1_0_0_/_0.1)] overflow-hidden">
              {/* Header with Add Button */}
              <div className="p-3 flex-shrink-0 flex justify-end">
                <button
                  onClick={() => {
                    setEditingPlaylist(null)
                    setIsAddModalOpen(true)
                  }}
                  className="w-9 h-9 flex items-center justify-center bg-[oklch(0.269_0_0)] hover:bg-[oklch(0.3_0_0)] hover:scale-105 active:scale-95 rounded-full text-[oklch(0.985_0_0)] transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              {/* Playlist List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-2 pb-2 space-y-1.5">
                  {allPlaylists.map((p, index) => (
                    <div
                      key={p.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left group cursor-pointer animate-scale-in",
                        p.id === playlistId 
                          ? "bg-[oklch(0.269_0_0)]" 
                          : "hover:bg-[oklch(0.269_0_0_/_0.5)] hover:translate-x-1"
                      )}
                      style={{ animationDelay: `${Math.min(index * 50, 300)}ms`, animationFillMode: 'backwards' }}
                      onClick={() => handleSwitchPlaylist(p.id)}
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[oklch(0.985_0_0)] text-sm truncate">
                          {p.name}
                        </p>
                        <p className="text-[oklch(0.556_0_0)] text-xs mt-0.5">
                          Updated {new Date(p.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      {/* Three-dot Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-full hover:bg-[oklch(1_0_0_/_0.15)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPlaylist(p)
                              setIsAddModalOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePlaylist(e as any, p.id)
                            }}
                            className="text-[oklch(0.704_0.191_22.216)]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  
                  {allPlaylists.length === 0 && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-8"
                    >
                      <p className="text-[oklch(0.556_0_0)] text-sm">No playlists yet</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Playlist Modal */}
      <AddPlaylistModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingPlaylist(null)
        }} 
        onSuccess={handleAddPlaylistSuccess}
        editPlaylist={editingPlaylist}
      />

      {/* Spotlight Search */}
      <SpotlightSearch
        isOpen={spotlightOpen}
        onOpenChange={setSpotlightOpen}
        items={allM3UItems}
        categories={categories}
        onSelectItem={(item) => {
          setSelectedItem(item)
          // Also set the category to show in sidebar
          if (item.groupTitle) {
            setSelectedCategory(item.groupTitle)
            setItems(allM3UItems.filter(i => i.groupTitle === item.groupTitle))
          }
        }}
        onSelectCategory={(categoryId) => {
          handleCategorySelect(categoryId)
          setSidebarVisible(true)
        }}
      />
      
    </div>
  )
}
