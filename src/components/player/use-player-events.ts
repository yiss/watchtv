import { useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePlayerStore } from '@/stores/player-store';

/**
 * Hook to manage player events (keyboard, mouse, fullscreen)
 */
export function usePlayerEvents() {
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setBuffered = usePlayerStore((s) => s.setBuffered);
  const videoElement = usePlayerStore((s) => s.videoElement);
  
  // Toggle fullscreen using Tauri's window API
  const toggleFullscreen = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      const currentFullscreen = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!currentFullscreen);
      setIsFullscreen(!currentFullscreen);
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [setIsFullscreen]);
  
  // Handle mouse movement to show/hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [setShowControls]);
  
  const handleMouseLeave = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setShowControls(false);
  }, [setShowControls]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    
    // Sync fullscreen state with Tauri window
    const syncFullscreenState = async () => {
      try {
        const appWindow = getCurrentWindow();
        const currentFullscreen = await appWindow.isFullscreen();
        setIsFullscreen(currentFullscreen);
      } catch (err) {
        // Ignore errors when not in Tauri context
      }
    };
    
    const interval = setInterval(syncFullscreenState, 500);
    
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      clearInterval(interval);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [toggleFullscreen, setIsFullscreen]);
  
  // Video element event listeners
  useEffect(() => {
    if (!videoElement) return;
    
    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
      if (videoElement.buffered.length > 0) {
        setBuffered(videoElement.buffered.end(videoElement.buffered.length - 1));
      }
    };
    const handleDurationChange = () => {
      if (isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
    };
    
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    
    return () => {
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
    };
  }, [videoElement, setIsPlaying, setCurrentTime, setDuration, setBuffered]);
  
  return {
    handleMouseMove,
    handleMouseLeave,
    toggleFullscreen,
  };
}
