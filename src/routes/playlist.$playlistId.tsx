import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
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

  // All items for M3U (since M3U usually loads everything at once)
  const [allM3UItems, setAllM3UItems] = useState<PlaylistItem[]>([])

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
      {/* Apple TV Style Top Navigation */}
      <nav className="flex items-center justify-center py-3 px-6 flex-shrink-0 z-20 relative">
        <div className="flex items-center gap-1 bg-[oklch(0.205_0_0)] rounded-full p-1 border border-[oklch(1_0_0_/_0.1)]">
          {/* Menu Toggle Icon */}
          <button 
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className={cn(
              "p-3 rounded-full transition-colors",
              sidebarVisible ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            <Menu className="h-5 w-5" />
          </button>
          
          {/* Grid Icon - Home */}
          <button 
            onClick={() => navigate({ to: '/' })}
            className="p-3 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] transition-colors text-[oklch(0.985_0_0)]"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          
          {/* TV Tab */}
          <button 
            onClick={() => setContentType('live')}
            className={cn(
              "px-8 py-2 rounded-full text-base font-medium transition-all",
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
              "px-8 py-2 rounded-full text-base font-medium transition-all",
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
              "px-8 py-2 rounded-full text-base font-medium transition-all",
              contentType === 'series' 
                ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
                : "text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0_/_0.1)]"
            )}
          >
            Series
          </button>
          
          {/* Search Icon */}
          <button className="p-3 rounded-full hover:bg-[oklch(1_0_0_/_0.1)] transition-colors text-[oklch(0.985_0_0)]">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Main Content Area - Relative container for overlay */}
      <div className="flex-1 relative overflow-hidden px-4 pb-4 pt-1">
        {/* Video Player and Info - Full width, always visible */}
        <div className="w-full h-full flex flex-col">
          {/* Video Player */}
          <div className="flex-1 rounded-2xl overflow-hidden bg-black min-h-0">
            {selectedItem ? (
              <VideoPlayer
                title={selectedItem.name}
                src={selectedItem.url}
                autoplay
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

          {/* Channel Info Bar */}
          {selectedItem && (
            <div className="mt-4 p-4 bg-[oklch(0.205_0_0_/_0.5)] rounded-2xl border border-[oklch(1_0_0_/_0.1)] flex items-center gap-4 flex-shrink-0">
              {/* Channel Logo */}
              {selectedItem.tvgLogo ? (
                <img 
                  src={selectedItem.tvgLogo} 
                  alt="" 
                  className="w-12 h-12 rounded-lg object-contain bg-[oklch(1_0_0_/_0.1)] flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[oklch(0.269_0_0)] flex items-center justify-center flex-shrink-0">
                  <Tv className="h-6 w-6 text-[oklch(0.556_0_0)]" />
                </div>
              )}
              
              {/* Channel Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-[oklch(0.985_0_0)] font-semibold text-lg truncate">
                  {selectedItem.name}
                </h2>
                <p className="text-[oklch(0.556_0_0)] text-sm truncate">
                  {selectedItem.groupTitle || 'Unknown Category'}
                </p>
              </div>

              {/* Quality Badge */}
              {quality && (
                <div className="flex-shrink-0">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[oklch(0.488_0.243_264.376)] text-[oklch(0.985_0_0)]">
                    {quality.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Stream Type Badge */}
              {contentType === 'live' && (
                <div className="flex-shrink-0">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[oklch(0.577_0.245_27.325)] text-[oklch(0.985_0_0)]">
                    LIVE
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Left Sidebar - Overlay on top of player */}
        {sidebarVisible && (
          <div className="absolute top-1 left-0 bottom-4 w-[400px] z-10 pl-0">
            <div className="h-full flex flex-col bg-[oklch(0.145_0_0_/_0.9)] backdrop-blur-xl rounded-2xl border border-[oklch(1_0_0_/_0.1)] overflow-hidden">
              {/* Search Box */}
              <div className="p-4 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[oklch(0.556_0_0)]" />
                  <Input 
                    placeholder="Search" 
                    className="pl-10 h-11 bg-[oklch(0.269_0_0)] border-0 rounded-xl text-[oklch(0.985_0_0)] placeholder:text-[oklch(0.556_0_0)] focus-visible:ring-1 focus-visible:ring-[oklch(1_0_0_/_0.3)]" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Back Button (when viewing items) */}
              {selectedCategory && (
                <button
                  onClick={handleBackToCategories}
                  className="mx-4 mb-2 flex items-center gap-2 text-sm text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to categories
                </button>
              )}
              
              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-1">
                  {selectedCategory ? (
                    // Show Items (Channels) with logos
                    (displayItems as PlaylistItem[]).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
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
                            className="w-8 h-8 rounded object-contain bg-[oklch(1_0_0_/_0.1)] flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center flex-shrink-0">
                            <Tv className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                          </div>
                        )}
                        <span className="text-[oklch(0.985_0_0)] text-sm font-medium truncate flex-1">
                          {item.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[oklch(0.556_0_0)] flex-shrink-0" />
                      </button>
                    ))
                  ) : (
                    // Show Categories
                    (displayItems as Category[]).map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[oklch(0.269_0_0_/_0.5)] transition-all text-left"
                      >
                        <span className="text-[oklch(0.985_0_0)] text-sm font-medium truncate flex-1">
                          {cat.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[oklch(0.556_0_0)] flex-shrink-0" />
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
