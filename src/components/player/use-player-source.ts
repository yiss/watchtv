import { useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { usePlayerStore } from '@/stores/player-store';

/**
 * Hook to manage video source loading and streaming
 */
export function usePlayerSource() {
  const src = usePlayerStore((s) => s.src);
  const transcodeUrl = usePlayerStore((s) => s.transcodeUrl);
  const isReady = usePlayerStore((s) => s.isReady);
  const isLive = usePlayerStore((s) => s.isLive);
  const videoElement = usePlayerStore((s) => s.videoElement);
  
  const setVideoSrc = usePlayerStore((s) => s.setVideoSrc);
  const setIsLoading = usePlayerStore((s) => s.setIsLoading);
  const setError = usePlayerStore((s) => s.setError);
  const setIsTranscoding = usePlayerStore((s) => s.setIsTranscoding);
  const setTranscodeUrl = usePlayerStore((s) => s.setTranscodeUrl);
  const setHlsInstance = usePlayerStore((s) => s.setHlsInstance);
  const setMpegtsInstance = usePlayerStore((s) => s.setMpegtsInstance);
  const cleanup = usePlayerStore((s) => s.cleanup);
  const seekToLive = usePlayerStore((s) => s.seekToLive);
  
  // Start transcoding for unsupported formats
  const startTranscode = useCallback(async (sourcePath: string) => {
    try {
      setIsTranscoding(true);
      setIsLoading(true);
      setError(null);
      
      await invoke('stop_transcode').catch(() => {});
      const url = await invoke<string>('start_transcode', { sourcePath });
      setTranscodeUrl(url);
    } catch (err) {
      console.error('Failed to start transcode:', err);
      setError(`Transcode failed: ${err}. Make sure FFmpeg is installed.`);
    }
  }, [setIsTranscoding, setIsLoading, setError, setTranscodeUrl]);
  
  // Compute video source (handle file:// and transcode URLs)
  useEffect(() => {
    if (!src) {
      setVideoSrc(null);
      return;
    }
    
    if (transcodeUrl) {
      setVideoSrc(transcodeUrl);
      return;
    }
    
    if (src.startsWith('file://')) {
      const filePath = src.replace('file://', '');
      setVideoSrc(convertFileSrc(filePath));
    } else {
      setVideoSrc(src);
    }
  }, [src, transcodeUrl, setVideoSrc]);
  
  // Cleanup transcode on unmount
  useEffect(() => {
    return () => {
      invoke('stop_transcode').catch(() => {});
    };
  }, []);
  
  // Load source when video element and source are ready
  useEffect(() => {
    const videoSrc = transcodeUrl || (src?.startsWith('file://') 
      ? convertFileSrc(src.replace('file://', '')) 
      : src);
    
    if (!videoElement || !videoSrc || !isReady) return;
    
    console.log('Loading video source:', videoSrc, '(original:', src, ')');
    setIsLoading(true);
    setError(null);
    
    // Cleanup previous instances
    cleanup();
    
    // Event handlers
    const handlePlay = () => {
      if (isLive) {
        seekToLive();
      }
    };
    
    const handleLoadedData = () => {
      console.log('Video loaded data');
      setIsLoading(false);
    };
    
    const handleCanPlay = () => {
      console.log('Video can play');
      setIsLoading(false);
    };
    
    const handlePlaying = () => {
      console.log('Video is playing');
      setIsLoading(false);
    };
    
    const handleError = () => {
      const err = videoElement.error;
      
      // If format not supported (code 4) or decode error (code 3), try transcoding
      if (err && (err.code === 3 || err.code === 4) && !transcodeUrl) {
        console.log('Format not supported, attempting to transcode...');
        startTranscode(src || '');
        return;
      }
      
      const errorMessages: Record<number, string> = {
        1: 'Video loading aborted',
        2: 'Network error - check your connection',
        3: 'Video decode error - format may not be supported',
        4: 'Video format not supported',
      };
      const message = err ? errorMessages[err.code] || 'Unknown video error' : 'Unknown error';
      console.error('Video error:', { code: err?.code, message, src });
      setError(message);
    };
    
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    
    // Determine stream type
    const isM3U8 = src?.includes('.m3u8');
    const isTSStream = src?.endsWith('.ts') || src?.includes('.ts?') || src?.includes('/live/');
    const isLocalFile = src?.startsWith('file://');
    const isUnsupportedFormat = /\.(mkv|avi|wmv|flv|mov)(\?|$)/i.test(src || '');
    
    // Detect Xtream Codes style streams (numeric path like /123456/abcdef/12345)
    const isXtreamStream = /:\d+\/\d+\/[a-zA-Z0-9]+\/\d+$/.test(src || '');
    // Detect if it's likely an IPTV stream (no clear extension, HTTP)
    const isIPTVStream = src?.startsWith('http') && !src?.match(/\.(m3u8|mp4|webm|ts|mkv|avi|wmv|flv|mov)(\?|$)/i);
    
    console.log('Stream detection:', { isM3U8, isTSStream, isLocalFile, isUnsupportedFormat, isXtreamStream, isIPTVStream });
    
    // For unsupported formats, start transcoding
    if (isUnsupportedFormat && !transcodeUrl) {
      console.log('Unsupported format detected, starting transcode');
      let sourcePath = src || '';
      if (sourcePath.startsWith('file://')) {
        sourcePath = sourcePath.replace('file://', '');
      }
      startTranscode(sourcePath);
      return () => {
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('playing', handlePlaying);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
      };
    }
    
    // For Xtream Codes or unknown IPTV streams, try mpegts.js first
    if ((isXtreamStream || isIPTVStream) && !isM3U8 && mpegts.isSupported()) {
      console.log('Using mpegts.js for IPTV/Xtream stream');
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: isLive,
        url: videoSrc,
      }, {
        enableWorker: true,
        // Buffer settings for smoother playback
        enableStashBuffer: true,
        stashInitialSize: 1024 * 384, // 384KB initial buffer
        // Live stream settings
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 5.0, // Max 5 seconds behind live
        liveBufferLatencyMinRemain: 1.0, // Keep at least 1 second buffer
        // Auto cleanup for memory
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 60, // Keep 60 seconds of backward buffer
        autoCleanupMinBackwardDuration: 30, // Min 30 seconds before cleanup
        // Seeking optimization
        seekType: 'range',
        // Larger chunks for better network efficiency
        lazyLoadMaxDuration: 180, // 3 minutes
        lazyLoadRecoverDuration: 30, // Recover 30 seconds ahead
      });
      
      setMpegtsInstance(player);
      player.attachMediaElement(videoElement);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error('mpegts.js error for IPTV stream:', errorType, errorDetail, errorInfo);
        // If mpegts fails, try transcoding
        if (!transcodeUrl) {
          console.log('mpegts.js failed, falling back to transcode');
          cleanup();
          startTranscode(src || '');
        } else {
          setError(`Stream error: ${errorDetail}`);
        }
      });
    }
    // For local files or direct streams
    else if (isLocalFile || (!isM3U8 && !isTSStream && !isXtreamStream && !isIPTVStream)) {
      console.log('Playing local/direct file:', videoSrc);
      videoElement.src = videoSrc;
    }
    // For M3U8 streams, use HLS.js
    else if (isM3U8 && Hls.isSupported()) {
      console.log('Using HLS.js for M3U8 stream');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        // Buffer settings
        liveSyncDurationCount: 4, // Segments to keep in live sync
        liveMaxLatencyDurationCount: 12, // Max segments behind live edge
        liveDurationInfinity: true, // For live streams
        // Buffering
        maxBufferLength: 30, // Max buffer ahead in seconds
        maxMaxBufferLength: 60, // Absolute max buffer
        maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer size
        maxBufferHole: 0.5, // Max gap in buffer to tolerate
        // Loading
        fragLoadingMaxRetry: 6, // Retry fragment loading
        fragLoadingRetryDelay: 1000, // 1 second retry delay
        fragLoadingMaxRetryTimeout: 64000, // Max retry timeout
        // Start position
        startPosition: -1, // Start from live edge for live streams
        // ABR (Adaptive Bitrate)
        abrEwmaDefaultEstimate: 500000, // Initial bandwidth estimate (500kbps)
        abrBandWidthFactor: 0.95, // Conservative bandwidth usage
        abrBandWidthUpFactor: 0.7, // Even more conservative for upgrade
      });
      setHlsInstance(hls);
      
      hls.loadSource(videoSrc);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed');
        setIsLoading(false);
      });
      
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          setError('Stream error: ' + data.type);
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
    } else if (isM3U8 && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      console.log('Using native HLS support');
      videoElement.src = videoSrc;
    } else if (isTSStream && !isM3U8 && mpegts.isSupported()) {
      // For .ts streams, use mpegts.js
      console.log('Using mpegts.js for TS stream');
      
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: isLive,
        url: videoSrc,
      }, {
        enableWorker: true,
        // Buffer settings for smoother playback
        enableStashBuffer: true,
        stashInitialSize: 1024 * 384, // 384KB initial buffer
        // Live stream settings
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 5.0,
        liveBufferLatencyMinRemain: 1.0,
        // Auto cleanup for memory
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 60,
        autoCleanupMinBackwardDuration: 30,
        // Seeking optimization
        seekType: 'range',
        lazyLoadMaxDuration: 180,
        lazyLoadRecoverDuration: 30,
      });
      
      setMpegtsInstance(player);
      player.attachMediaElement(videoElement);
      player.load();
      
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error('mpegts.js error:', errorType, errorDetail, errorInfo);
        // Try transcoding if mpegts fails
        if (!transcodeUrl) {
          console.log('mpegts.js failed, falling back to transcode');
          cleanup();
          startTranscode(src || '');
        } else {
          setError(`Stream error: ${errorDetail}`);
        }
      });
    }
    
    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('error', handleError);
    };
  }, [src, transcodeUrl, isReady, isLive, videoElement, cleanup, setIsLoading, setError, setHlsInstance, setMpegtsInstance, startTranscode, seekToLive]);
}
