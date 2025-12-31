import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { cn } from '@/lib/utils';
import { Tv, Loader2, AlertCircle, RefreshCw, Play } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

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
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [_isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeUrl, setTranscodeUrl] = useState<string | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  
  // Play with external mpv player
  const playWithMpv = useCallback(async () => {
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
  }, [src, channelInfo?.name]);

  // Start transcoding for unsupported formats
  const startTranscode = useCallback(async (sourcePath: string) => {
    try {
      setIsTranscoding(true);
      setIsLoading(true);
      setError(null);
      
      // Stop any previous transcode
      await invoke('stop_transcode').catch(() => {});
      
      // Start new transcode
      const url = await invoke<string>('start_transcode', { sourcePath });
      setTranscodeUrl(url);
      setIsTranscoding(false);
    } catch (err) {
      console.error('Failed to start transcode:', err);
      setError(`Transcode failed: ${err}. Make sure FFmpeg is installed.`);
      setIsTranscoding(false);
      setIsLoading(false);
    }
  }, []);

  // Cleanup transcode on unmount
  useEffect(() => {
    return () => {
      invoke('stop_transcode').catch(() => {});
    };
  }, []);

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

  // Handle fullscreen using Tauri's window API
  const toggleFullscreen = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      const currentFullscreen = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!currentFullscreen);
      setIsFullscreen(!currentFullscreen);
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Listen for 'f' key for fullscreen and sync fullscreen state
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

    // Check fullscreen state periodically (handles ESC key and other exits)
    const interval = setInterval(syncFullscreenState, 500);
    
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      clearInterval(interval);
    };
  }, [toggleFullscreen]);

  // Initialize Plyr
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
        hideControls: isLive, // Only hide controls for live, show for VOD
        resetOnEnd: false,
      });
      
      // Add error handling for player
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
      
      setIsReady(true);
    };

    initPlyr();

    return () => {
      isMounted = false;
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      // Safely destroy HLS instance
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying HLS:', e);
        }
        hlsRef.current = null;
      }
      // Safely destroy mpegts instance
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.unload();
          mpegtsRef.current.detachMediaElement();
          mpegtsRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying mpegts:', e);
        }
        mpegtsRef.current = null;
      }
      // Safely destroy Plyr instance
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying Plyr:', e);
        }
        playerRef.current = null;
      }
    };
  }, [isLive]);

  // Seek to live edge (used when resuming from pause in live mode)
  const seekToLive = useCallback(() => {
    if (!videoRef.current) return;
    
    // For HLS streams, seek to the live sync position
    if (hlsRef.current) {
      const hls = hlsRef.current;
      const livePosition = hls.liveSyncPosition;
      // Use liveSyncPosition if available, otherwise seek to buffered end
      if (livePosition !== undefined && livePosition !== null && livePosition > 0) {
        videoRef.current.currentTime = livePosition;
      } else if (videoRef.current.buffered.length > 0) {
        // Seek to near the end of the buffered range (leave small buffer)
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        videoRef.current.currentTime = Math.max(0, bufferedEnd - 1);
      }
    } else if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
      // For non-HLS live streams, seek to near the end
      videoRef.current.currentTime = videoRef.current.duration - 0.5;
    } else if (videoRef.current.buffered.length > 0) {
      // Fallback: seek to buffered end
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      videoRef.current.currentTime = Math.max(0, bufferedEnd - 1);
    }
  }, []);

  // Convert file:// URLs to asset URLs for Tauri WebView
  const videoSrc = useMemo(() => {
    // If we have a transcode URL, use that
    if (transcodeUrl) {
      return transcodeUrl;
    }
    
    if (src.startsWith('file://')) {
      // Remove file:// prefix and convert to asset URL
      const filePath = src.replace('file://', '');
      return convertFileSrc(filePath);
    }
    return src;
  }, [src, transcodeUrl]);

  // Load source
  useEffect(() => {
    if (!videoRef.current || !videoSrc || !isReady) return;

    console.log('Loading video source:', videoSrc, '(original:', src, ')');
    setIsLoading(true);
    setError(null);

    // Clean up previous instances safely
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying previous HLS:', e);
      }
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying previous mpegts:', e);
      }
      mpegtsRef.current = null;
    }

    const video = videoRef.current;
    
    // Clear any previous error handlers
    video.onerror = null;
    video.onloadedmetadata = null;
    video.oncanplay = null;

    // For live TV: when play is triggered after pause, seek to live first
    const handlePlay = () => {
      if (isLive) {
        seekToLive();
      }
    };

    // Common handlers
    const handleLoadedData = () => {
      console.log('Video loaded data');
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      console.log('Video can play');
      setIsLoading(false);
    };

    const handleError = () => {
      const err = video.error;
      const errorMessages: Record<number, string> = {
        1: 'Video loading aborted',
        2: 'Network error - check your connection',
        3: 'Video decode error - format may not be supported',
        4: 'Video format not supported',
      };
      const message = err ? errorMessages[err.code] || 'Unknown video error' : 'Unknown error';
      console.error('Video error:', { code: err?.code, message, src });
      setError(message);
      setIsLoading(false);
    };

    // Add event listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Determine stream type
    const isM3U8 = src.includes('.m3u8');
    const isTSStream = src.endsWith('.ts') || src.includes('.ts?') || src.includes('/live/');
    const isMovieStream = src.includes('/movie/');
    const isSeriesStream = src.includes('/series/');
    const isLocalFile = src.startsWith('file://');
    
    // Check for browser-supported formats (MP4, WebM can play natively)
    const isBrowserSupported = /\.(mp4|webm|ogg|ogv)(\?|$)/i.test(src);
    
    // Check for unsupported formats (MKV, AVI, etc. - browsers can't play these)
    const isUnsupportedFormat = /\.(mkv|avi|wmv|flv|mov)(\?|$)/i.test(src);
    
    console.log('Stream detection:', { isM3U8, isTSStream, isMovieStream, isSeriesStream, isBrowserSupported, isUnsupportedFormat, isLocalFile });

    // For unsupported formats, start transcoding
    if (isUnsupportedFormat && !transcodeUrl) {
      console.log('Unsupported format detected, starting transcode');
      // Extract the actual file path for transcoding
      let sourcePath = src;
      if (src.startsWith('file://')) {
        sourcePath = src.replace('file://', '');
      }
      startTranscode(sourcePath);
      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    }

    // For local files or direct streams (MP4, etc.)
    if (isLocalFile || (!isM3U8 && !isTSStream)) {
      console.log('Playing local/direct file:', videoSrc);
      video.src = videoSrc;

      if (autoplay) {
        video.play().catch((e) => {
          console.error('Initial play error:', e);
        });
      }
    }
    // For M3U8 streams, use HLS.js
    else if (isM3U8 && Hls.isSupported()) {
      console.log('Using HLS.js for M3U8 stream');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });
      hlsRef.current = hls;
      
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed');
        setIsLoading(false);
        if (autoplay) {
          video.play().catch((e) => {
            console.error('Autoplay blocked:', e);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          setError('Stream error: ' + data.type);
          setIsLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('HLS network error, retrying...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('HLS media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error, destroying');
              hls.destroy();
              break;
          }
        }
      });
    } else if (isM3U8 && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      console.log('Using native HLS support');
      video.src = videoSrc;
      if (autoplay) {
        video.play().catch(() => {});
      }
    } else if (isTSStream && !isM3U8 && mpegts.isSupported()) {
      // For .ts streams (IPTV live streams), use mpegts.js
      console.log('Using mpegts.js for TS stream');
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: isLive,
        url: videoSrc,
      }, {
        enableWorker: true,
        enableStashBuffer: false,
        stashInitialSize: 128,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 3.0,
        liveBufferLatencyMinRemain: 0.5,
      });
      
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error('mpegts.js error:', errorType, errorDetail, errorInfo);
        setError(`Stream error: ${errorDetail}`);
        setIsLoading(false);
      });
      
      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        console.log('mpegts.js loading complete');
      });
      
      player.on(mpegts.Events.RECOVERED_EARLY_EOF, () => {
        console.log('mpegts.js recovered from early EOF');
      });
      
      if (autoplay) {
        video.play().catch((e) => {
          console.error('Autoplay blocked:', e);
        });
      }
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [src, videoSrc, autoplay, isReady, isLive, seekToLive, transcodeUrl, startTranscode]);

  return (
    <div 
      ref={containerRef} 
      className={cn('w-full h-full plyr-container relative', isLive && 'is-live', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
      />
      
      {/* Loading Overlay */}
      {(isLoading || isTranscoding) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
            <span className="text-white/80 text-sm">
              {isTranscoding ? 'Converting video format...' : 'Loading...'}
            </span>
            {isTranscoding && (
              <span className="text-white/50 text-xs">This may take a moment for large files</span>
            )}
          </div>
        </div>
      )}
      
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
          <div className="flex flex-col items-center gap-4 max-w-md px-6 text-center">
            <AlertCircle className="h-12 w-12 text-[oklch(0.704_0.191_22.216)]" />
            <span className="text-white text-lg font-medium">
              {error.includes('external player') ? 'Unsupported Format' : 'Playback Error'}
            </span>
            <span className="text-white/60 text-sm">{error}</span>
            
            <div className="flex flex-col gap-3 w-full mt-2">
              {/* Play with mpv - Primary action for unsupported formats */}
              <button
                onClick={playWithMpv}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[oklch(0.488_0.243_264.376)] hover:bg-[oklch(0.55_0.243_264.376)] text-white font-medium transition-colors"
              >
                <Play className="h-5 w-5" />
                Open in External Player
              </button>
              
              {/* Retry button - only show for non-format errors */}
              {!error.includes('external player') && (
                <button
                  onClick={() => {
                    setError(null);
                    setIsLoading(true);
                    retryCountRef.current += 1;
                    if (videoRef.current) {
                      videoRef.current.src = src;
                      videoRef.current.load();
                      if (autoplay) videoRef.current.play().catch(() => {});
                    }
                  }}
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
      )}
      
      {/* Channel Info Overlay - Shows with controls */}
      {channelInfo && (
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 p-4 bg-linear-to-b from-black/70 to-transparent transition-opacity duration-300 z-10",
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
