import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Plus, Tv, Radio, Film } from 'lucide-react'
import { Playlist } from '@/types'
import { getPlaylists } from '@/lib/storage'
import { AddPlaylistModal } from '@/components/playlist/AddPlaylistModal'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setPlaylists(getPlaylists())
  }, [isModalOpen])

  const handlePlaylistClick = (id: string) => {
    navigate({ to: '/playlist/$playlistId', params: { playlistId: id } })
  }

  return (
    <div className="min-h-screen bg-[oklch(0.145_0_0)] text-[oklch(0.985_0_0)]">
      {/* Draggable title bar region for macOS */}
      <div data-tauri-drag-region className="h-8 flex-shrink-0 w-full" />
      
      {/* Header */}
      <header className="flex items-center justify-center py-6 -mt-8 pt-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.577_0.245_27.325)] flex items-center justify-center">
            <Tv className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">WatchTV</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pb-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[oklch(0.708_0_0)]">Your Playlists</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)] font-medium text-sm hover:bg-[oklch(0.922_0_0)] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Playlist
          </button>
        </div>

        {playlists.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="w-20 h-20 rounded-2xl bg-[oklch(0.205_0_0)] flex items-center justify-center mb-6">
              <Radio className="h-10 w-10 text-[oklch(0.556_0_0)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Playlists Yet</h3>
            <p className="text-[oklch(0.556_0_0)] text-center max-w-md mb-6">
              Add your first IPTV playlist to start watching live TV, movies, and series.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)] font-medium hover:bg-[oklch(0.922_0_0)] transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Your First Playlist
            </button>
          </div>
        ) : (
          /* Playlist Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handlePlaylistClick(playlist.id)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200",
                  "bg-[oklch(0.205_0_0)] hover:bg-[oklch(0.239_0_0)]",
                  "border border-[oklch(1_0_0_/_0.08)] hover:border-[oklch(1_0_0_/_0.15)]"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                  playlist.type === 'm3u' 
                    ? "bg-[oklch(0.488_0.243_264.376)]" 
                    : "bg-[oklch(0.577_0.245_27.325)]"
                )}>
                  {playlist.type === 'm3u' ? (
                    <Radio className="h-6 w-6 text-white" />
                  ) : (
                    <Film className="h-6 w-6 text-white" />
                  )}
                </div>

                {/* Content */}
                <h3 className="font-semibold text-base mb-1 truncate">
                  {playlist.name}
                </h3>
                <p className="text-sm text-[oklch(0.556_0_0)]">
                  {playlist.type === 'm3u' ? 'M3U Playlist' : 'Xtream Codes'}
                </p>

                {/* Timestamp */}
                <p className="text-xs text-[oklch(0.446_0_0)] mt-3">
                  Updated {new Date(playlist.updatedAt).toLocaleDateString()}
                </p>

                {/* Hover Arrow */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-[oklch(1_0_0_/_0.1)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[oklch(0.985_0_0)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}

            {/* Add New Card */}
            <button
              onClick={() => setIsModalOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl p-5 min-h-[180px] transition-all duration-200",
                "border-2 border-dashed border-[oklch(1_0_0_/_0.1)] hover:border-[oklch(1_0_0_/_0.2)]",
                "hover:bg-[oklch(0.205_0_0_/_0.5)]"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.269_0_0)] flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-[oklch(0.556_0_0)]" />
              </div>
              <span className="text-sm text-[oklch(0.556_0_0)]">Add Playlist</span>
            </button>
          </div>
        )}
      </main>

      <AddPlaylistModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
            setIsModalOpen(false)
            setPlaylists(getPlaylists())
        }}
      />
    </div>
  )
}
