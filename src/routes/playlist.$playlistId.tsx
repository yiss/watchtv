import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { 
  Tv, 
  Search, 
  ChevronRight, 
  LayoutGrid,
  Menu
} from 'lucide-react'
import { Playlist, PlaylistItem, Category } from '@/types'
import { getPlaylists } from '@/lib/storage'
import { fetchM3UPlaylist, fetchXtreamCategories, fetchXtreamItems } from '@/lib/api/iptv'
import { Input } from '@/components/ui/input'
import { VideoPlayer } from '@/components/player/VideoPlayer'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

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
  const [contentType, setContentType] = useState<'live' | 'movie' | 'series'>('live')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [selectedItem, setSelectedItem] = useState<PlaylistItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // All items for M3U (since M3U usually loads everything at once)
  const [allM3UItems, setAllM3UItems] = useState<PlaylistItem[]>([])

  // Handle click outside sidebar to dismiss it
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      sidebarVisible && 
      sidebarRef.current && 
      !sidebarRef.current.contains(event.target as Node)
    ) {
      // Check if click is on the menu toggle button
      const menuButton = document.querySelector('[data-menu-toggle]')
      if (menuButton && menuButton.contains(event.target as Node)) {
        return
      }
      setSidebarVisible(false)
    }
  }, [sidebarVisible])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  useEffect(() => {
    const p = getPlaylists().find((p) => p.id === playlistId)
    if (p) {
      setPlaylist(p)
      loadInitialData(p)
    } else {
      navigate({ to: '/' })
    }
  }, [playlistId])

  const loadInitialData = async (p: Playlist) => {
    try {
      if (p.type === 'm3u' && p.url) {
        const allItems = await fetchM3UPlaylist(p.url)
        setAllM3UItems(allItems)
        
        // Extract categories from M3U
        const uniqueCategories = Array.from(new Set(allItems.map(i => i.groupTitle).filter(Boolean)))
        setCategories(uniqueCategories.map(name => ({ id: name!, name: name!, type: 'live' })))
      } else if (p.type === 'xtream') {
        const cats = await fetchXtreamCategories(p, contentType)
        setCategories(cats)
        if (cats.length > 0) {
          handleCategorySelect(cats[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load playlist', error)
    }
  }

  // Reload categories when content type changes for Xtream
  useEffect(() => {
    if (playlist?.type === 'xtream') {
        fetchXtreamCategories(playlist, contentType).then(cats => {
            setCategories(cats)
            setItems([])
            setSelectedCategory(null)
        })
    }
  }, [contentType])

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId)
    if (playlist?.type === 'm3u') {
      const filtered = allM3UItems.filter(i => i.groupTitle === categoryId)
      setItems(filtered)
    } else if (playlist?.type === 'xtream') {
      try {
        const fetchedItems = await fetchXtreamItems(playlist, contentType, categoryId)
        setItems(fetchedItems)
      } catch (error) {
        console.error('Failed to fetch items', error)
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

  const quality = selectedItem ? extractQuality(selectedItem.name) : null

  return (
    <div className="flex flex-col h-screen w-full bg-[oklch(0.145_0_0)] overflow-hidden">
      {/* Draggable title bar region for macOS */}
      <div data-tauri-drag-region className="h-8 flex-shrink-0 w-full" />
      
      {/* Apple TV Style Top Navigation */}
      <nav className="flex items-center justify-center py-2 px-4 flex-shrink-0 z-20 relative -mt-8 pt-8">
        <div className="flex items-center gap-1.5 bg-[oklch(0.205_0_0)] rounded-full p-1 border border-[oklch(1_0_0_/_0.1)]">
          {/* Menu Toggle Icon */}
          <button 
            data-menu-toggle
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className={cn(
              "p-2.5 rounded-full transition-colors",
              sidebarVisible ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            <Menu className="h-4 w-4" />
          </button>
          
          {/* Grid Icon - Home */}
          <button 
            onClick={() => navigate({ to: '/' })}
            className="p-2.5 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] transition-colors text-[oklch(0.985_0_0)]"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          
          {/* TV Tab */}
          <button 
            onClick={() => setContentType('live')}
            className={cn(
              "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
              contentType === 'live' 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            TV
          </button>
          
          {/* Movies Tab */}
          <button 
            onClick={() => setContentType('movie')}
            className={cn(
              "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
              contentType === 'movie' 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            Movies
          </button>
          
          {/* Series Tab */}
          <button 
            onClick={() => setContentType('series')}
            className={cn(
              "px-6 py-1.5 rounded-full text-sm font-medium transition-all",
              contentType === 'series' 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            Series
          </button>
          
          {/* Search Icon */}
          <button className="p-2.5 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] transition-colors text-[oklch(0.985_0_0)]">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </nav>

      {/* Main Content Area - Relative container for overlay */}
      <div className="flex-1 relative overflow-hidden px-4 pb-4 pt-1">
        {/* Video Player - Full width and height */}
        <div className="w-full h-full rounded-2xl overflow-hidden bg-black">
          {selectedItem ? (
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

        {/* Left Sidebar - Overlay on top of player */}
        {sidebarVisible && (
          <div ref={sidebarRef} className="absolute top-1 left-2 bottom-4 w-[340px] z-10">
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
                <div className="px-2 pb-2 space-y-0.5">
                  {selectedCategory ? (
                    // Show Items (Channels) with logos
                    (displayItems as PlaylistItem[]).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left",
                          selectedItem?.id === item.id 
                            ? "bg-[oklch(0.269_0_0)]" 
                            : "hover:bg-[oklch(0.269_0_0_/_0.5)]"
                        )}
                      >
                        {/* Channel Logo */}
                        {item.tvgLogo ? (
                          <img 
                            src={item.tvgLogo} 
                            alt="" 
                            className="w-7 h-7 rounded object-contain bg-[oklch(1_0_0_/_0.1)] shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0">
                            <Tv className="h-3.5 w-3.5 text-[oklch(0.556_0_0)]" />
                          </div>
                        )}
                        <span className="text-[oklch(0.985_0_0)] text-sm truncate flex-1">
                          {item.name}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0" />
                      </button>
                    ))
                  ) : (
                    // Show Categories
                    (displayItems as Category[]).map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[oklch(0.269_0_0_/_0.5)] transition-all text-left"
                      >
                        <span className="text-[oklch(0.985_0_0)] text-sm truncate flex-1">
                          {cat.name}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
