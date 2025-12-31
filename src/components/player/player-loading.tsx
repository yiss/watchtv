import { memo, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useIsTranscoding, useIsPlaying, usePlayerStore } from '@/stores/player-store';

export const PlayerLoading = memo(function PlayerLoading() {
  const isTranscoding = useIsTranscoding();
  const isPlaying = useIsPlaying();
  const videoElement = usePlayerStore((s) => s.videoElement);
  const currentTime = usePlayerStore((s) => s.currentTime);
  
  // Track if video has ever played (once it plays, never show loading again for this source)
  const [hasPlayed, setHasPlayed] = useState(false);
  
  // Reset hasPlayed when video element changes (new source)
  useEffect(() => {
    setHasPlayed(false);
  }, [videoElement]);
  
  // Once video is playing or has time > 0, mark as played
  useEffect(() => {
    if (isPlaying || currentTime > 0) {
      setHasPlayed(true);
    }
  }, [isPlaying, currentTime]);
  
  // Never show loading if video has started playing
  if (hasPlayed) return null;
  
  // Only show transcoding indicator
  if (!isTranscoding) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 text-white animate-spin" />
        <span className="text-white/80 text-sm">
          Converting video format...
        </span>
        <span className="text-white/50 text-xs">This may take a moment for large files</span>
      </div>
    </div>
  );
});
