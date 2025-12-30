import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

import {
  MediaProvider,
  MediaPlayer,
  type MediaPlayerProps,
  Poster,
} from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import { cn } from '@/lib/utils';

interface VideoPlayerProps extends Omit<MediaPlayerProps, 'children'> {
  title: string;
  src: string;
}

export function VideoPlayer({ title, src, className, ...props }: VideoPlayerProps) {
  return (
    <MediaPlayer
      className={cn(
        "w-full h-full bg-black text-white",
        className
      )}
      title={title}
      src={src}
      crossOrigin
      playsInline
      viewType="video"
      streamType="live"
      logLevel="warn"
      keyTarget="document"
      keyShortcuts={{
        toggleFullscreen: 'f',
        togglePaused: 'k Space',
        toggleMuted: 'm',
        volumeUp: 'ArrowUp',
        volumeDown: 'ArrowDown',
        seekForward: 'ArrowRight',
        seekBackward: 'ArrowLeft',
      }}
      {...props}
    >
      <MediaProvider>
        <Poster 
          className="vds-poster absolute inset-0 block h-full w-full opacity-0 transition-opacity data-visible:opacity-100 object-cover" 
        />
      </MediaProvider>
      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        thumbnails=""
      />
    </MediaPlayer>
  );
}
