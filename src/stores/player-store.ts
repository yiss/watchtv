import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

export interface ChannelInfo {
  name: string;
  category?: string;
  logo?: string;
  quality?: string;
}

interface PlayerState {
  // Video source
  src: string | null;
  videoSrc: string | null;
  
  // Channel info
  channelInfo: ChannelInfo | null;
  isLive: boolean;
  
  // Player state
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  isFullscreen: boolean;
  showControls: boolean;
  
  // Error state
  error: string | null;
  
  // Transcoding
  isTranscoding: boolean;
  transcodeUrl: string | null;
  
  // Volume
  volume: number;
  isMuted: boolean;
  
  // Progress (for VOD)
  currentTime: number;
  duration: number;
  buffered: number;
  
  // Refs (not persisted, just for access)
  videoElement: HTMLVideoElement | null;
  hlsInstance: Hls | null;
  mpegtsInstance: mpegts.Player | null;
}

interface PlayerActions {
  // Source management
  setSrc: (src: string, channelInfo?: ChannelInfo, isLive?: boolean) => void;
  setVideoSrc: (videoSrc: string | null) => void;
  clearSource: () => void;
  
  // State updates
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsReady: (ready: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setShowControls: (show: boolean) => void;
  setError: (error: string | null) => void;
  
  // Transcoding
  setIsTranscoding: (transcoding: boolean) => void;
  setTranscodeUrl: (url: string | null) => void;
  
  // Volume
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  
  // Progress
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;
  
  // Refs
  setVideoElement: (el: HTMLVideoElement | null) => void;
  setHlsInstance: (hls: Hls | null) => void;
  setMpegtsInstance: (player: mpegts.Player | null) => void;
  
  // Player controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekToLive: () => void;
  
  // Cleanup
  cleanup: () => void;
}

const initialState: PlayerState = {
  src: null,
  videoSrc: null,
  channelInfo: null,
  isLive: true,
  isPlaying: false,
  isLoading: false,
  isReady: false,
  isFullscreen: false,
  showControls: false,
  error: null,
  isTranscoding: false,
  transcodeUrl: null,
  volume: 1,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  videoElement: null,
  hlsInstance: null,
  mpegtsInstance: null,
};

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    // Source management
    setSrc: (src, channelInfo, isLive = true) => {
      set({
        src,
        channelInfo: channelInfo || null,
        isLive,
        error: null,
        isLoading: true,
        transcodeUrl: null,
        isTranscoding: false,
      });
    },
    
    setVideoSrc: (videoSrc) => set({ videoSrc }),
    
    clearSource: () => {
      const { cleanup } = get();
      cleanup();
      set({
        src: null,
        videoSrc: null,
        channelInfo: null,
        error: null,
        isLoading: false,
        transcodeUrl: null,
        isTranscoding: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
      });
    },
    
    // State updates
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setIsReady: (isReady) => set({ isReady }),
    setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
    setShowControls: (showControls) => set({ showControls }),
    setError: (error) => set({ error, isLoading: false }),
    
    // Transcoding
    setIsTranscoding: (isTranscoding) => set({ isTranscoding }),
    setTranscodeUrl: (transcodeUrl) => set({ transcodeUrl, isTranscoding: false }),
    
    // Volume
    setVolume: (volume) => {
      const { videoElement } = get();
      if (videoElement) {
        videoElement.volume = volume;
      }
      set({ volume, isMuted: volume === 0 });
    },
    
    setIsMuted: (isMuted) => {
      const { videoElement } = get();
      if (videoElement) {
        videoElement.muted = isMuted;
      }
      set({ isMuted });
    },
    
    toggleMute: () => {
      const { isMuted, videoElement } = get();
      if (videoElement) {
        videoElement.muted = !isMuted;
      }
      set({ isMuted: !isMuted });
    },
    
    // Progress
    setCurrentTime: (currentTime) => set({ currentTime }),
    setDuration: (duration) => set({ duration }),
    setBuffered: (buffered) => set({ buffered }),
    
    // Refs
    setVideoElement: (videoElement) => set({ videoElement }),
    setHlsInstance: (hlsInstance) => set({ hlsInstance }),
    setMpegtsInstance: (mpegtsInstance) => set({ mpegtsInstance }),
    
    // Player controls
    play: () => {
      const { videoElement, isLive, seekToLive } = get();
      if (videoElement) {
        if (isLive) {
          seekToLive();
        }
        videoElement.play().catch(console.error);
      }
    },
    
    pause: () => {
      const { videoElement } = get();
      if (videoElement) {
        videoElement.pause();
      }
    },
    
    togglePlay: () => {
      const { isPlaying, play, pause } = get();
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    },
    
    seek: (time) => {
      const { videoElement } = get();
      if (videoElement) {
        videoElement.currentTime = time;
      }
    },
    
    seekToLive: () => {
      const { videoElement, hlsInstance } = get();
      if (!videoElement) return;
      
      // For HLS streams, seek to the live sync position
      if (hlsInstance) {
        const livePosition = hlsInstance.liveSyncPosition;
        if (livePosition !== undefined && livePosition !== null && livePosition > 0) {
          videoElement.currentTime = livePosition;
        } else if (videoElement.buffered.length > 0) {
          const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
          videoElement.currentTime = Math.max(0, bufferedEnd - 1);
        }
      } else if (videoElement.duration && isFinite(videoElement.duration)) {
        videoElement.currentTime = videoElement.duration - 0.5;
      } else if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        videoElement.currentTime = Math.max(0, bufferedEnd - 1);
      }
    },
    
    // Cleanup
    cleanup: () => {
      const { hlsInstance, mpegtsInstance } = get();
      
      if (hlsInstance) {
        try {
          hlsInstance.destroy();
        } catch (e) {
          console.warn('Error destroying HLS:', e);
        }
      }
      
      if (mpegtsInstance) {
        try {
          mpegtsInstance.unload();
          mpegtsInstance.detachMediaElement();
          mpegtsInstance.destroy();
        } catch (e) {
          console.warn('Error destroying mpegts:', e);
        }
      }
      
      set({
        hlsInstance: null,
        mpegtsInstance: null,
      });
    },
  }))
);

// Selector hooks for better performance
export const usePlayerSrc = () => usePlayerStore((s) => s.src);
export const usePlayerVideoSrc = () => usePlayerStore((s) => s.videoSrc);
export const useChannelInfo = () => usePlayerStore((s) => s.channelInfo);
export const useIsLive = () => usePlayerStore((s) => s.isLive);
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying);
export const useIsLoading = () => usePlayerStore((s) => s.isLoading);
export const useIsReady = () => usePlayerStore((s) => s.isReady);
export const useIsFullscreen = () => usePlayerStore((s) => s.isFullscreen);
export const useShowControls = () => usePlayerStore((s) => s.showControls);
export const usePlayerError = () => usePlayerStore((s) => s.error);
export const useIsTranscoding = () => usePlayerStore((s) => s.isTranscoding);
export const useVolume = () => usePlayerStore((s) => s.volume);
export const useIsMuted = () => usePlayerStore((s) => s.isMuted);
export const useCurrentTime = () => usePlayerStore((s) => s.currentTime);
export const useDuration = () => usePlayerStore((s) => s.duration);
export const useBuffered = () => usePlayerStore((s) => s.buffered);
