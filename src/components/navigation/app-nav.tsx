import { motion } from 'motion/react'
import { Menu, Antenna, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContentTabs } from './content-tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface AppNavProps {
  sidebarVisible: boolean
  playlistMenuVisible: boolean
  onToggleSidebar: () => void
  onTogglePlaylistMenu: () => void
  onOpenSearch: () => void
  activeTab: 'live' | 'movie' | 'series' | 'offline'
  onTabChange: (tab: 'live' | 'movie' | 'series' | 'offline') => void
  hasMovies: boolean
  hasSeries: boolean
  hasOffline: boolean
}

export function AppNav({
  sidebarVisible,
  playlistMenuVisible,
  onToggleSidebar,
  onTogglePlaylistMenu,
  onOpenSearch,
  activeTab,
  onTabChange,
  hasMovies,
  hasSeries,
  hasOffline,
}: AppNavProps) {
  return (
    <motion.nav 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
      data-tauri-drag-region
      className="flex items-center justify-center py-3 px-6 flex-shrink-0 z-20 relative -mt-8 pt-8 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 bg-[oklch(0.18_0_0)] rounded-full px-2 py-1.5 border border-[oklch(1_0_0/0.08)] shadow-xl shadow-black/30" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Menu Toggle Icon - Categories/Channels */}
        <NavButton
          isActive={sidebarVisible}
          onClick={onToggleSidebar}
          icon={<Menu className="h-5 w-5" />}
          dataAttr="data-menu-toggle"
        />
        
        {/* Playlist Icon - Playlist Management */}
        <NavButton
          isActive={playlistMenuVisible}
          onClick={onTogglePlaylistMenu}
          icon={<Antenna className="h-5 w-5" />}
          dataAttr="data-playlist-toggle"
        />
        
        {/* Separator */}
        <div className="w-px h-6 bg-[oklch(1_0_0/0.1)]" />
        
        {/* Content Tabs */}
        <ContentTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          hasMovies={hasMovies}
          hasSeries={hasSeries}
          hasOffline={hasOffline}
        />
        
        {/* Separator */}
        <div className="w-px h-6 bg-[oklch(1_0_0/0.1)]" />
        
        {/* Search Icon - Opens Spotlight Search */}
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <div 
                {...props}
                role="button"
                tabIndex={0}
                onClick={onOpenSearch}
                onKeyDown={(e) => e.key === 'Enter' && onOpenSearch()}
                className="p-2.5 rounded-full transition-all duration-200 text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0/0.08)] cursor-pointer select-none"
              >
                <Search className="h-5 w-5" />
              </div>
            )}
          />
          <TooltipContent>
            Search (⌘K)
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.nav>
  )
}

interface NavButtonProps {
  isActive: boolean
  onClick: () => void
  icon: React.ReactNode
  dataAttr: string
}

function NavButton({ isActive, onClick, icon, dataAttr }: NavButtonProps) {
  return (
    <div 
      role="button"
      tabIndex={0}
      {...{ [dataAttr]: true }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn(
        "p-2.5 rounded-full transition-all duration-200 cursor-pointer select-none",
        isActive 
          ? "bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]" 
          : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)] hover:bg-[oklch(1_0_0/0.08)]"
      )}
    >
      {icon}
    </div>
  )
}
