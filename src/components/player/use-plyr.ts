import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePlayerStore } from '@/stores/player-store';

/**
 * Hook to initialize and manage Plyr player
 */
export function usePlyr(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const playerRef = useRef<any>(null);
  
  const isLive = usePlayerStore((s) => s.isLive);
  const setIsReady = usePlayerStore((s) => s.setIsReady);
  const setIsFullscreen = usePlayerStore((s) => s.setIsFullscreen);
  const setVideoElement = usePlayerStore((s) => s.setVideoElement);
  const cleanup = usePlayerStore((s) => s.cleanup);
  
  useEffect(() => {
    let isMounted = true;
    
    const initPlyr = async () => {
      if (!videoRef.current) return;
      
      // @ts-ignore - Plyr has module issues with TypeScript
      const Plyr = (await import('plyr')).default;
      
      if (!isMounted || !videoRef.current) return;
      
      // For live TV, include play/pause but no progress bar or seeking
      const liveControls = [
        'play-large',
        'play',
        'mute',
        'volume',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ];
      
      // For VOD, include play/pause and progress
      const vodControls = [
        'play-large',
        'play',
        'progress',
        'current-time',
        'mute',
        'volume',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ];
      
      playerRef.current = new Plyr(videoRef.current, {
        controls: isLive ? liveControls : vodControls,
        settings: ['quality', 'speed'],
        autoplay: false,
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: true },
        fullscreen: { 
          enabled: true, 
          fallback: true, 
          iosNative: true,
        },
        clickToPlay: true,
        hideControls: isLive,
        resetOnEnd: false,
      });
      
      playerRef.current.on('error', (event: any) => {
        console.error('Plyr error:', event);
      });
      
      playerRef.current.on('ready', () => {
        console.log('Plyr ready, isLive:', isLive);
      });
      
      // Override Plyr's fullscreen to use Tauri's window fullscreen
      playerRef.current.on('enterfullscreen', async () => {
        try {
          const appWindow = getCurrentWindow();
          const currentFullscreen = await appWindow.isFullscreen();
          if (!currentFullscreen) {
            await appWindow.setFullscreen(true);
            setIsFullscreen(true);
          }
        } catch (err) {
          console.error('Enter fullscreen error:', err);
        }
      });
      
      playerRef.current.on('exitfullscreen', async () => {
        try {
          const appWindow = getCurrentWindow();
          const currentFullscreen = await appWindow.isFullscreen();
          if (currentFullscreen) {
            await appWindow.setFullscreen(false);
            setIsFullscreen(false);
          }
        } catch (err) {
          console.error('Exit fullscreen error:', err);
        }
      });
      
      // Store video element reference in store
      setVideoElement(videoRef.current);
      setIsReady(true);
    };
    
    initPlyr();
    
    return () => {
      isMounted = false;
      cleanup();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying Plyr:', e);
        }
        playerRef.current = null;
      }
    };
  }, [isLive, setIsReady, setIsFullscreen, setVideoElement, cleanup, videoRef]);
  
  return playerRef;
}
