import { useEffect, useRef, useState, useCallback } from 'react';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { Tv } from 'lucide-react';

interface ChannelInfo {
  name: string;
  category?: string;
  logo?: string;
  quality?: string;
}

interface VideoPlayerProps {
  title: string;
  src: string;
  autoplay?: boolean;
  className?: string;
  isLive?: boolean;
  channelInfo?: ChannelInfo;
}

export function VideoPlayer({ 
  src, 
  autoplay = false, 
  className, 
  isLive = true,
  channelInfo 
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle mouse movement to show/hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setShowControls(false);
  }, []);

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen error:', err);
      });
    }
  }, []);

  // Listen for 'f' key for fullscreen
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [toggleFullscreen]);

  // Initialize Plyr
  useEffect(() => {
    let isMounted = true;
    
    const initPlyr = async () => {
      if (!videoRef.current) return;
      
      // @ts-ignore - Plyr has module issues with TypeScript
      const Plyr = (await import('plyr')).default;
      
      if (!isMounted || !videoRef.current) return;
      
      // For live TV, remove play/pause controls
      const liveControls = [
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
        clickToPlay: !isLive,
        hideControls: true,
        resetOnEnd: false,
      });

      // Override Plyr's fullscreen to use our container
      playerRef.current.on('enterfullscreen', () => {
        if (!document.fullscreenElement && containerRef.current) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      });
      
      setIsReady(true);
    };

    initPlyr();

    return () => {
      isMounted = false;
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hlsRef.current?.destroy();
      playerRef.current?.destroy();
    };
  }, [isLive]);

  // Load source
  useEffect(() => {
    if (!videoRef.current || !src || !isReady) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if the source is HLS
    const isHLS = src.includes('.m3u8') || src.includes('m3u');

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay && videoRef.current) {
          videoRef.current.play().catch(() => {
            // Autoplay blocked
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      videoRef.current.src = src;
      if (autoplay) {
        videoRef.current.play().catch(() => {});
      }
    } else {
      // Regular video source
      videoRef.current.src = src;
      if (autoplay) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [src, autoplay, isReady]);

  return (
    <div 
      ref={containerRef} 
      className={cn('w-full h-full plyr-container relative', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        crossOrigin="anonymous"
      />
      
      {/* Channel Info Overlay - Shows with controls */}
      {channelInfo && (
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center gap-3">
            {/* Channel Logo */}
            {channelInfo.logo ? (
              <img 
                src={channelInfo.logo} 
                alt="" 
                className="w-10 h-10 rounded-lg object-contain bg-white/10 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Tv className="h-5 w-5 text-white/60" />
              </div>
            )}
            
            {/* Channel Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold text-base truncate">
                {channelInfo.name}
              </h2>
              {channelInfo.category && (
                <p className="text-white/60 text-sm truncate">
                  {channelInfo.category}
                </p>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {channelInfo.quality && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[oklch(0.488_0.243_264.376)] text-white">
                  {channelInfo.quality.toUpperCase()}
                </span>
              )}
              {isLive && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[oklch(0.577_0.245_27.325)] text-white">
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
