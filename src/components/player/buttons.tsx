import {
  CaptionButton,
  FullscreenButton,
  MuteButton,
  PIPButton,
  PlayButton,
  Tooltip,
  type TooltipContentProps,
} from '@vidstack/react';
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Play,
  Pause,
  PictureInPicture,
  PictureInPicture2,
  Captions,
} from 'lucide-react';

export interface ButtonProps {
  tooltipPlacement?: TooltipContentProps['placement'];
  tooltipOffset?: TooltipContentProps['offset'];
}

export const buttonClass =
  'group ring-media-focus relative mr-0.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md outline-none ring-inset hover:bg-white/20 data-[focus]:ring-4 disabled:hidden';

export const tooltipClass =
  'animate-out fade-out slide-out-to-bottom-2 data-[visible]:animate-in data-[visible]:fade-in data-[visible]:slide-in-from-bottom-2 z-10 rounded-sm bg-black/90 px-2 py-0.5 text-xs font-medium text-white shadow-sm';

export function PlayTooltip({ placement, offset }: TooltipContentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <PlayButton className={buttonClass}>
          <Play className="h-7 w-7 fill-white translate-x-px hidden group-data-[paused]:block" />
          <Pause className="h-7 w-7 fill-white block group-data-[paused]:hidden" />
        </PlayButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={tooltipClass} placement={placement} offset={offset}>
        <span className="hidden group-data-[paused]:block">Play</span>
        <span className="block group-data-[paused]:hidden">Pause</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

export function MuteTooltip({ placement, offset }: TooltipContentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <MuteButton className={buttonClass}>
          <VolumeX className="h-7 w-7 hidden group-data-[volume=0]:block group-data-[muted]:block" />
          <Volume2 className="h-7 w-7 block group-data-[volume=0]:hidden group-data-[muted]:hidden" />
        </MuteButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={tooltipClass} placement={placement} offset={offset}>
        <span className="hidden group-data-[muted]:block">Unmute</span>
        <span className="block group-data-[muted]:hidden">Mute</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

export function CaptionTooltip({ placement, offset }: TooltipContentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <CaptionButton className={buttonClass}>
          <Captions className="h-7 w-7" />
        </CaptionButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={tooltipClass} placement={placement} offset={offset}>
        <span className="group-data-[active]:hidden">Closed-Captions On</span>
        <span className="hidden group-data-[active]:block">Closed-Captions Off</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

export function PIPTooltip({ placement, offset }: TooltipContentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <PIPButton className={buttonClass}>
          <PictureInPicture className="h-7 w-7 block group-data-[active]:hidden" />
          <PictureInPicture2 className="h-7 w-7 hidden group-data-[active]:block" />
        </PIPButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={tooltipClass} placement={placement} offset={offset}>
        <span className="group-data-[active]:hidden">Enter PIP</span>
        <span className="hidden group-data-[active]:block">Exit PIP</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

export function FullscreenTooltip({ placement, offset }: TooltipContentProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <FullscreenButton className={buttonClass}>
          <Maximize className="h-7 w-7 block group-data-[active]:hidden" />
          <Minimize className="h-7 w-7 hidden group-data-[active]:block" />
        </FullscreenButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={tooltipClass} placement={placement} offset={offset}>
        <span className="group-data-[active]:hidden">Enter Fullscreen</span>
        <span className="hidden group-data-[active]:block">Exit Fullscreen</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}