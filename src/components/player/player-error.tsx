import { memo, useCallback } from 'react';
import { AlertCircle, RefreshCw, Play } from 'lucide-react';
import { usePlayerStore, usePlayerError } from '@/stores/player-store';
import { invoke } from '@tauri-apps/api/core';

export const PlayerError = memo(function PlayerError() {
  const error = usePlayerError();
  const src = usePlayerStore((s) => s.src);
  const channelInfo = usePlayerStore((s) => s.channelInfo);
  const videoElement = usePlayerStore((s) => s.videoElement);
  const setError = usePlayerStore((s) => s.setError);
  const setIsLoading = usePlayerStore((s) => s.setIsLoading);
  
  const playWithMpv = useCallback(async () => {
    if (!src) return;
    try {
      setIsLoading(true);
      await invoke('play_with_mpv', { 
        url: src, 
        title: channelInfo?.name || 'Video' 
      });
      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to play with mpv:', err);
      setError(`${err}`);
      setIsLoading(false);
    }
  }, [src, channelInfo?.name, setError, setIsLoading]);
  
  const handleRetry = useCallback(() => {
    if (!src || !videoElement) return;
    setError(null);
    setIsLoading(true);
    videoElement.src = src;
    videoElement.load();
    videoElement.play().catch(() => {});
  }, [src, videoElement, setError, setIsLoading]);
  
  if (!error) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
      <div className="flex flex-col items-center gap-4 max-w-md px-6 text-center">
        <AlertCircle className="h-12 w-12 text-[oklch(0.704_0.191_22.216)]" />
        <span className="text-white text-lg font-medium">
          {error.includes('external player') ? 'Unsupported Format' : 'Playback Error'}
        </span>
        <span className="text-white/60 text-sm">{error}</span>
        
        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={playWithMpv}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[oklch(0.488_0.243_264.376)] hover:bg-[oklch(0.55_0.243_264.376)] text-white font-medium transition-colors"
          >
            <Play className="h-5 w-5" />
            Open in External Player
          </button>
          
          {!error.includes('external player') && (
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[oklch(0.269_0_0)] hover:bg-[oklch(0.3_0_0)] text-white text-sm transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          
          <p className="text-white/40 text-xs mt-2">
            Requires mpv, VLC, or IINA installed
          </p>
        </div>
      </div>
    </div>
  );
});
