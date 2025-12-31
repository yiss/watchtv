import { useEffect, useRef, memo } from 'react';
import 'plyr/dist/plyr.css';
import { cn } from '@/lib/utils';
import { usePlayerStore, ChannelInfo } from '@/stores/player-store';
import { PlayerLoading } from './player-loading';
import { PlayerError } from './player-error';
import { PlayerChannelInfo } from './player-channel-info';
import { usePlayerSource } from './use-player-source';
import { usePlayerEvents } from './use-player-events';
import { usePlyr } from './use-plyr';

interface VideoPlayerProps {
  title: string;
  src: string;
  autoplay?: boolean;
  className?: string;
  isLive?: boolean;
  channelInfo?: ChannelInfo;
}

export const VideoPlayer = memo(function VideoPlayer({ 
  src, 
  autoplay = false, 
  className, 
  isLive = true,
  channelInfo 
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Store actions
  const setSrc = usePlayerStore((s) => s.setSrc);
  const storedIsLive = usePlayerStore((s) => s.isLive);
  
  // Set source when props change
  useEffect(() => {
    setSrc(src, channelInfo, isLive);
  }, [src, channelInfo, isLive, setSrc]);
  
  // Initialize Plyr
  usePlyr(videoRef);
  
  // Load and manage video source
  usePlayerSource();
  
  // Handle player events (keyboard, mouse, fullscreen)
  const { handleMouseMove, handleMouseLeave } = usePlayerEvents();
  
  // Auto-play when ready
  const videoElement = usePlayerStore((s) => s.videoElement);
  const isReady = usePlayerStore((s) => s.isReady);
  
  useEffect(() => {
    if (autoplay && videoElement && isReady) {
      videoElement.play().catch((e) => {
        console.error('Autoplay blocked:', e);
      });
    }
  }, [autoplay, videoElement, isReady]);
  
  return (
    <div 
      ref={containerRef} 
      className={cn('w-full h-full plyr-container relative', storedIsLive && 'is-live', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
      />
      
      <PlayerLoading />
      <PlayerError />
      <PlayerChannelInfo />
    </div>
  );
});

// Re-export types
export type { ChannelInfo };
