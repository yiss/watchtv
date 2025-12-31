import { memo } from 'react';
import { Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChannelInfo, useShowControls, useIsLive } from '@/stores/player-store';

export const PlayerChannelInfo = memo(function PlayerChannelInfo() {
  const channelInfo = useChannelInfo();
  const showControls = useShowControls();
  const isLive = useIsLive();
  
  if (!channelInfo) return null;
  
  return (
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
  );
});
