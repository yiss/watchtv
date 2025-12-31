import { useRef, useState, useLayoutEffect } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

type TabType = 'live' | 'movie' | 'series' | 'offline'

interface ContentTabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  hasMovies: boolean
  hasSeries: boolean
  hasOffline: boolean
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'live', label: 'TV' },
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'offline', label: 'Offline' },
]

export function ContentTabs({
  activeTab,
  onTabChange,
  hasMovies,
  hasSeries,
  hasOffline,
}: ContentTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  // Update indicator position when active tab changes
  useLayoutEffect(() => {
    const activeTabEl = tabRefs.current[activeTab]
    const container = containerRef.current
    if (activeTabEl && container) {
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeTabEl.getBoundingClientRect()
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      })
    }
  }, [activeTab])

  const isDisabled = (tab: TabType): boolean => {
    if (tab === 'movie') return !hasMovies
    if (tab === 'series') return !hasSeries
    if (tab === 'offline') return !hasOffline
    return false
  }

  return (
    <div ref={containerRef} className="relative flex items-center rounded-full">
      {/* Animated Tab Indicator */}
      <motion.div 
        className="absolute top-0 bottom-0 bg-[oklch(0.985_0_0)] rounded-full shadow-md"
        initial={false}
        animate={{
          left: indicator.left,
          width: indicator.width,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
      />
      
      {TABS.map((tab) => (
        <div
          key={tab.id}
          ref={(el) => { tabRefs.current[tab.id] = el }}
          role="button"
          tabIndex={0}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange(tab.id)}
          className={cn(
            "relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer select-none",
            activeTab === tab.id 
              ? "text-[oklch(0.145_0_0)]" 
              : isDisabled(tab.id)
                ? "text-[oklch(0.4_0_0)] cursor-not-allowed"
                : "text-[oklch(0.85_0_0)] hover:text-[oklch(0.985_0_0)]"
          )}
        >
          {tab.label}
        </div>
      ))}
    </div>
  )
}
