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
