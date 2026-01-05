import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import { z } from 'zod'
import { Playlist } from '@/types'
import { AppNav } from '@/components/navigation'
import { CategorySidebar, PlaylistSidebar } from '@/components/sidebar'
import { PlayerContainer } from '@/components/player/player-container'
import { UnavailableMessage } from '@/components/ui/unavailable-message'
import { AddPlaylistModal } from '@/components/playlist/add-playlist-modal'
import { SpotlightSearch } from '@/components/search/spotlight-search'
import { usePlaylistData } from '@/hooks/use-playlist-data'
import { useIsFullscreen } from '@/stores/player-store'

// Search params schema for URL state
const searchParamsSchema = z.object({
  tab: z.enum(['live', 'movie', 'series', 'offline']).optional().catch('live'),
  category: z.string().optional(),
  channel: z.string().optional(),
})

export const Route = createFileRoute('/playlist/$playlistId')({
  component: PlaylistPage,
  validateSearch: searchParamsSchema,
})

function PlaylistPage() {
  const { playlistId } = Route.useParams()
  const navigate = useNavigate()
  const search = Route.useSearch()
  
  // Use the playlist data hook
  const [state, actions] = usePlaylistData(playlistId)
  
  // Player state
  const isFullscreen = useIsFullscreen()
  
  // UI state - sidebar starts closed until data loads
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [playlistMenuVisible, setPlaylistMenuVisible] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'live' | 'movie' | 'series' | 'offline'>(search.tab || 'live')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Refs
  const sidebarRef = useRef<HTMLDivElement>(null)
  const playlistMenuRef = useRef<HTMLDivElement>(null)

  // Sync activeTab with search params
  useEffect(() => {
    if (search.tab && search.tab !== activeTab) {
      setActiveTab(search.tab)
    }
  }, [search.tab])

  // Load playlist on mount
  useEffect(() => {
    actions.loadPlaylist(playlistId)
  }, [playlistId])

  // Open sidebar once data is fully loaded (both main loading and sidebar loading must be complete)
  useEffect(() => {
    if (state.isLoading || state.sidebarLoading) return
    
    const hasContent = state.categories.length > 0 || state.offlineItems.length > 0
    if (hasContent) {
      setSidebarVisible(true)
    }
  }, [state.isLoading, state.sidebarLoading, state.categories.length, state.offlineItems.length])

  // Auto-dismiss unavailable message
  useEffect(() => {
    if (unavailableMessage) {
      const timer = setTimeout(() => setUnavailableMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [unavailableMessage])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Don't close sidebars when clicking on the nav bar
      const navBar = document.querySelector('nav')
      if (navBar && navBar.contains(target)) return
      
      if (
        sidebarVisible && 
        sidebarRef.current && 
        !sidebarRef.current.contains(target)
      ) {
        const menuButton = document.querySelector('[data-menu-toggle]')
        if (menuButton && menuButton.contains(target)) return
        setSidebarVisible(false)
      }
      
      if (
        playlistMenuVisible && 
        playlistMenuRef.current && 
        !playlistMenuRef.current.contains(target)
      ) {
        const playlistButton = document.querySelector('[data-playlist-toggle]')
        if (playlistButton && playlistButton.contains(target)) return
        setPlaylistMenuVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarVisible, playlistMenuVisible])

  // Tab change handler with URL update
  const handleTabChange = useCallback((newTab: 'live' | 'movie' | 'series' | 'offline') => {
    if (newTab === activeTab) return
    
    // Check availability
    if (newTab === 'movie' && !state.hasMovies) {
      setUnavailableMessage('This playlist does not contain movies')
      return
    }
    if (newTab === 'series' && !state.hasSeries) {
      setUnavailableMessage('This playlist does not contain series')
      return
    }
    if (newTab === 'offline' && !state.hasOffline) {
      setUnavailableMessage('No offline content available. Download movies or series first.')
      return
    }
    
    // Reset playback
    actions.selectItem(null)
    setActiveTab(newTab)
    
    // Update URL
    navigate({
      to: '/playlist/$playlistId',
      params: { playlistId },
      search: { tab: newTab },
      replace: true,
    })
    
    // Update content type (not for offline)
    if (newTab !== 'offline') {
      setTimeout(() => {
        actions.setContentType(newTab)
      }, 50)
    }
  }, [activeTab, state.hasMovies, state.hasSeries, state.hasOffline, playlistId, navigate, actions])

  // Sidebar handlers
  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible(prev => {
      // If opening sidebar, close playlist menu
      if (!prev && playlistMenuVisible) {
        setPlaylistMenuVisible(false)
      }
      return !prev
    })
  }, [playlistMenuVisible])

  const handleTogglePlaylistMenu = useCallback(() => {
    setPlaylistMenuVisible(prev => {
      // If opening playlist menu, close sidebar
      if (!prev && sidebarVisible) {
        setSidebarVisible(false)
      }
      return !prev
    })
  }, [sidebarVisible])

  // Playlist management handlers
  const handleSwitchPlaylist = useCallback((id: string) => {
    setPlaylistMenuVisible(false)
    actions.switchPlaylist(id)
  }, [actions])

  const handleDeletePlaylist = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    actions.deletePlaylist(id)
  }, [actions])

  const handleAddPlaylistSuccess = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingPlaylist(null)
    actions.refreshPlaylists()
  }, [actions])

  // Retry loading
  const handleRetry = useCallback(() => {
    if (state.playlist) {
      actions.loadInitialData(state.playlist)
    }
  }, [state.playlist, actions])

  return (
    <div className="flex flex-col h-screen w-full bg-[oklch(0.145_0_0)] overflow-hidden">
      {/* Draggable title bar region for macOS - hidden in fullscreen */}
      {!isFullscreen && (
        <div 
          data-tauri-drag-region 
          className="h-8 shrink-0 w-full select-none cursor-default" 
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} 
        />
      )}
      
      {/* Top Navigation - hidden in fullscreen */}
      {!isFullscreen && (
        <AppNav
          sidebarVisible={sidebarVisible}
          playlistMenuVisible={playlistMenuVisible}
          onToggleSidebar={handleToggleSidebar}
          onTogglePlaylistMenu={handleTogglePlaylistMenu}
          onOpenSearch={() => setSpotlightOpen(true)}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hasMovies={state.hasMovies}
          hasSeries={state.hasSeries}
          hasOffline={state.hasOffline}
        />
      )}

      {/* Unavailable Message - hidden in fullscreen */}
      {!isFullscreen && (
        <UnavailableMessage 
          message={unavailableMessage} 
          onDismiss={() => setUnavailableMessage(null)} 
        />
      )}

      {/* Main Content Area */}
      <div className={`flex-1 relative overflow-hidden ${isFullscreen ? '' : 'px-4 pb-4 pt-1'}`}>
        {/* Video Player */}
        <PlayerContainer
          isLoading={state.isLoading}
          loadError={state.loadError}
          selectedItem={state.selectedItem}
          contentType={state.contentType}
          onRetry={handleRetry}
        />

        {/* Category/Channel Sidebar - hidden in fullscreen */}
        <AnimatePresence>
          {sidebarVisible && !isFullscreen && (
            <CategorySidebar
              ref={sidebarRef}
              isVisible={sidebarVisible}
              isLoading={state.isLoading}
              sidebarLoading={state.sidebarLoading}
              loadError={state.loadError}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={state.selectedCategory}
              onBackToCategories={() => {
                actions.backToCategories()
                setSearchQuery('')
              }}
              activeTab={activeTab}
              contentType={state.contentType}
              categories={state.categories}
              items={state.items}
              offlineItems={state.offlineItems}
              selectedItem={state.selectedItem}
              onSelectCategory={actions.selectCategory}
              onSelectItem={actions.selectItem}
              onDownload={actions.handleDownload}
              onCancelDownload={actions.handleCancelDownload}
              onDeleteOfflineItem={actions.handleDeleteOfflineItem}
              downloadingIds={state.downloadingIds}
              downloadProgress={state.downloadProgress}
              isItemDownloaded={actions.isItemDownloadedFn}
            />
          )}
        </AnimatePresence>

        {/* Playlist Management Sidebar - hidden in fullscreen */}
        <AnimatePresence>
          {playlistMenuVisible && !isFullscreen && (
            <PlaylistSidebar
              ref={playlistMenuRef}
              playlists={state.allPlaylists}
              currentPlaylistId={playlistId}
              onSelectPlaylist={handleSwitchPlaylist}
              onAddPlaylist={() => {
                setEditingPlaylist(null)
                setIsAddModalOpen(true)
              }}
              onEditPlaylist={(p) => {
                setEditingPlaylist(p)
                setIsAddModalOpen(true)
              }}
              onDeletePlaylist={handleDeletePlaylist}
            />
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
        items={state.allM3UItems}
        categories={state.categories}
        onSelectItem={(item) => {
          actions.selectItem(item)
          if (item.groupTitle) {
            actions.selectCategory(item.groupTitle)
          }
        }}
        onSelectCategory={(categoryId) => {
          actions.selectCategory(categoryId)
          setSidebarVisible(true)
        }}
      />
    </div>
  )
}

