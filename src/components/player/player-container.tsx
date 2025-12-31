import { Tv, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { VideoPlayer } from './video-player'
import { PlaylistItem } from '@/types'

interface PlayerContainerProps {
  isLoading: boolean
  loadError: string | null
  selectedItem: PlaylistItem | null
  contentType: 'live' | 'movie' | 'series'
  onRetry: () => void
}

export function PlayerContainer({
  isLoading,
  loadError,
  selectedItem,
  contentType,
  onRetry,
}: PlayerContainerProps) {
  // Extract quality from channel name (e.g., "Channel Name (1080p)" -> "1080p")
  const quality = selectedItem ? extractQuality(selectedItem.name) : null

  // Show player if item is selected (even if still loading categories)
  // Only show loading state when no item selected and still loading
  const showPlayer = selectedItem !== null
  const showLoading = isLoading && !selectedItem
  const showError = loadError && !selectedItem
  const showEmpty = !isLoading && !loadError && !selectedItem

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-black relative isolate">
      {showLoading ? (
        <LoadingState />
      ) : showError ? (
        <ErrorState error={loadError!} onRetry={onRetry} />
      ) : showPlayer ? (
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
      ) : showEmpty ? (
        <EmptyState />
      ) : null}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center text-[oklch(0.556_0_0)]">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
        <p className="text-lg">Loading playlist...</p>
        <p className="text-sm mt-2 opacity-70">This may take a moment for large playlists</p>
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center text-[oklch(0.556_0_0)] max-w-md px-4">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[oklch(0.704_0.191_22.216)]" />
        <p className="text-lg text-[oklch(0.985_0_0)] mb-2">Failed to Load Playlist</p>
        <p className="text-sm opacity-70 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[oklch(0.269_0_0)] hover:bg-[oklch(0.3_0_0)] text-[oklch(0.985_0_0)] text-sm transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center text-[oklch(0.556_0_0)]">
        <Tv className="h-20 w-20 mx-auto mb-4 opacity-30" />
        <p className="text-lg">Select a channel to start watching</p>
      </div>
    </div>
  )
}

function extractQuality(name: string): string | null {
  const match = name.match(/\((\d+p)\)/i)
  return match ? match[1] : null
}
