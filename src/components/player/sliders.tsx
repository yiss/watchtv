import { TimeSlider, VolumeSlider } from '@vidstack/react';

export function Time() {
  return (
    <TimeSlider.Root className="group relative mx-2 inline-flex h-10 w-full cursor-pointer touch-none select-none items-center outline-none">
      <TimeSlider.Track className="relative ring-media-focus z-0 h-[5px] w-full rounded-sm bg-white/30 group-data-[focus]:ring-4">
        <TimeSlider.TrackFill className="bg-primary absolute h-full w-[var(--slider-fill)] rounded-sm will-change-[width]" />
        <TimeSlider.Progress className="absolute h-full w-[var(--slider-progress)] rounded-sm bg-white/50 will-change-[width]" />
      </TimeSlider.Track>
      <TimeSlider.Preview className="pointer-events-none flex flex-col items-center opacity-0 transition-opacity duration-200 data-[visible]:opacity-100">
        <TimeSlider.Thumbnail.Root
            src="" // Thumbnails support is complex, skipping for now
            className="block h-[var(--thumbnail-height)] max-h-[160px] min-h-[80px] w-[var(--thumbnail-width)] min-w-[120px] max-w-[180px] overflow-hidden border border-white bg-black"
        >
            <TimeSlider.Thumbnail.Img />
        </TimeSlider.Thumbnail.Root>
        <TimeSlider.Value className="text-[13px]" />
      </TimeSlider.Preview>
      <TimeSlider.Thumb className="absolute left-[var(--slider-fill)] z-10 h-[15px] w-[15px] -translate-x-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 ring-white/40 transition-opacity group-data-[active]:opacity-100 group-data-[dragging]:ring-4 will-change-[left]" />
    </TimeSlider.Root>
  );
}

export function Volume() {
  return (
    <VolumeSlider.Root className="group relative mx-2 inline-flex h-10 w-full max-w-[80px] cursor-pointer touch-none select-none items-center outline-none">
      <VolumeSlider.Track className="relative ring-media-focus z-0 h-[5px] w-full rounded-sm bg-white/30 group-data-[focus]:ring-4">
        <VolumeSlider.TrackFill className="bg-primary absolute h-full w-[var(--slider-fill)] rounded-sm will-change-[width]" />
      </VolumeSlider.Track>
      <VolumeSlider.Preview className="pointer-events-none flex flex-col items-center opacity-0 transition-opacity duration-200 data-[visible]:opacity-100">
        <VolumeSlider.Value className="rounded-sm bg-black px-2 py-px text-[13px] font-medium" />
      </VolumeSlider.Preview>
      <VolumeSlider.Thumb className="absolute left-[var(--slider-fill)] z-10 h-[15px] w-[15px] -translate-x-1/2 rounded-full border border-[#cacaca] bg-white opacity-0 ring-white/40 transition-opacity group-data-[active]:opacity-100 group-data-[dragging]:ring-4 will-change-[left]" />
    </VolumeSlider.Root>
  );
}
