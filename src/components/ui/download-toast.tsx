import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Pie progress indicator for cards
interface PieProgressProps {
  progress: number // 0 to 1
  size?: number
  className?: string
}

export function PieProgress({ progress, size = 24, className }: PieProgressProps) {
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)
  
  return (
    <svg 
      width={size} 
      height={size} 
      className={cn("transform -rotate-90", className)}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="oklch(0.145 0 0 / 0.8)"
        stroke="oklch(0.269 0 0)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="oklch(0.488 0.243 264.376)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-300 ease-out"
      />
      {/* Center percentage text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[6px] font-bold fill-white transform rotate-90"
        style={{ transformOrigin: 'center' }}
      >
        {Math.round(progress * 100)}
      </text>
    </svg>
  )
}

// Download toast with progress bar and cancel button
interface DownloadToastProps {
  name: string
  progress: number // 0 to 1
  downloadedBytes: number
  totalBytes: number | null
  speed: number | null
  onCancel: () => void
}

export function DownloadToast({ 
  name, 
  progress, 
  downloadedBytes, 
  totalBytes, 
  speed, 
  onCancel 
}: DownloadToastProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }
  
  const percentage = Math.round(progress * 100)
  const speedStr = speed ? `${formatBytes(speed)}/s` : null
  const sizeStr = totalBytes 
    ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
    : formatBytes(downloadedBytes)
  
  return (
    <div className="w-80 p-4 bg-[oklch(0.18_0_0)] rounded-xl border border-[oklch(1_0_0/0.1)] shadow-xl">
      {/* Header with name and cancel button */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm font-medium text-[oklch(0.985_0_0)] truncate flex-1" title={name}>
          {name}
        </span>
        <button
          onClick={onCancel}
          className="p-1.5 -m-1 rounded-full hover:bg-[oklch(1_0_0/0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors shrink-0"
          title="Cancel download"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="h-1.5 bg-[oklch(0.269_0_0)] rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-[oklch(0.488_0.243_264.376)] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-[oklch(0.556_0_0)]">
        <span>{sizeStr}</span>
        <div className="flex items-center gap-3">
          {speedStr && <span>{speedStr}</span>}
          <span className="font-medium text-[oklch(0.985_0_0)]">{percentage}%</span>
        </div>
      </div>
    </div>
  )
}
