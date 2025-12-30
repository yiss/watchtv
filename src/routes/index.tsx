import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Playlist } from '@/types'
import { getPlaylists } from '@/lib/storage'
import { AddPlaylistModal } from '@/components/playlist/AddPlaylistModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from '@tanstack/react-router'

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
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Playlists</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Playlist
        </Button>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-20 bg-muted/50 rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">No playlists found. Click the button above to add one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <Card 
              key={playlist.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handlePlaylistClick(playlist.id)}
            >
              <CardHeader>
                <CardTitle>{playlist.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {playlist.type === 'm3u' ? 'M3U Link' : 'Xtream Codes'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {new Date(playlist.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
