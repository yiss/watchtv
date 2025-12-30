import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Tv } from 'lucide-react'
import { getPlaylists, getLastViewed } from '@/lib/storage'
import { AddPlaylistModal } from '@/components/playlist/AddPlaylistModal'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const playlists = getPlaylists()
    const lastViewed = getLastViewed()
    
    // If user has playlists, redirect to last viewed or first playlist
    if (playlists.length > 0) {
      if (lastViewed && playlists.some(p => p.id === lastViewed.playlistId)) {
        navigate({ to: '/playlist/$playlistId', params: { playlistId: lastViewed.playlistId } })
      } else {
        navigate({ to: '/playlist/$playlistId', params: { playlistId: playlists[0].id } })
      }
    } else {
      setIsChecking(false)
    }
  }, [navigate])

  const handlePlaylistAdded = () => {
    setIsModalOpen(false)
    const playlists = getPlaylists()
    if (playlists.length > 0) {
      navigate({ to: '/playlist/$playlistId', params: { playlistId: playlists[0].id } })
    }
  }

  // Show nothing while checking for existing playlists
  if (isChecking) {
    return (
      <div className="h-screen bg-[oklch(0.145_0_0)] flex items-center justify-center">
        <div className="animate-pulse">
          <Tv className="h-12 w-12 text-[oklch(0.556_0_0)]" />
        </div>
      </div>
    )
  }

  // Welcome screen for new users
  return (
    <div className="h-screen bg-[oklch(0.145_0_0)] text-[oklch(0.985_0_0)] flex flex-col">
      {/* Draggable title bar region for macOS */}
      <div data-tauri-drag-region className="h-8 flex-shrink-0 w-full" />
      
      {/* Centered Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="text-center max-w-lg">
          {/* Welcome Text */}
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Welcome to Watch TV
          </h1>
          
          <p className="text-xl text-[oklch(0.708_0_0)] mb-12">
            Stream live TV, movies, and series from your IPTV playlists
          </p>
          
          {/* Get Started Button */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-full bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)] font-medium hover:bg-[oklch(0.922_0_0)] transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>

      <AddPlaylistModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handlePlaylistAdded}
      />
    </div>
  )
}
