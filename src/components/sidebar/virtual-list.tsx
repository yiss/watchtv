import { useRef, memo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { 
  ChevronRight, 
  Tv, 
  Film, 
  Download,
  HardDrive,
  Trash2,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlaylistItem, Category } from '@/types'
import { OfflineItem } from '@/lib/storage'
import { PieProgress } from '@/components/ui/download-toast'

// Row heights
const CATEGORY_ROW_HEIGHT = 44
const ITEM_ROW_HEIGHT = 52
const MOVIE_ROW_HEIGHT = 68

interface VirtualCategoryListProps {
  categories: Category[]
  onSelectCategory: (categoryId: string) => void
}

export const VirtualCategoryList = memo(function VirtualCategoryList({
  categories,
  onSelectCategory,
}: VirtualCategoryListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: categories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CATEGORY_ROW_HEIGHT,
    overscan: 10,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const category = categories[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <CategoryRow
                category={category}
                onSelect={onSelectCategory}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

interface CategoryRowProps {
  category: Category
  onSelect: (categoryId: string) => void
}

const CategoryRow = memo(function CategoryRow({ category, onSelect }: CategoryRowProps) {
  return (
    <button
      onClick={() => onSelect(category.id)}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[oklch(0.269_0_0/0.5)] hover:translate-x-1 transition-all duration-200 text-left"
    >
      <span className="text-[oklch(0.985_0_0)] text-sm truncate flex-1">
        {category.name}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0" />
    </button>
  )
})

interface VirtualItemListProps {
  items: PlaylistItem[]
  contentType: 'live' | 'movie' | 'series'
  selectedItem: PlaylistItem | null
  onSelectItem: (item: PlaylistItem) => void
  onDownload: (item: PlaylistItem) => void
  onCancelDownload: (id: string) => void
  downloadingIds: Set<string>
  downloadProgress: Record<string, number>
  isItemDownloaded: (id: string) => boolean
}

export const VirtualItemList = memo(function VirtualItemList({
  items,
  contentType,
  selectedItem,
  onSelectItem,
  onDownload,
  onCancelDownload,
  downloadingIds,
  downloadProgress,
  isItemDownloaded,
}: VirtualItemListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowHeight = contentType === 'live' ? ITEM_ROW_HEIGHT : MOVIE_ROW_HEIGHT

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
  })

  const virtualItems = virtualizer.getVirtualItems()

  const handleDownload = useCallback((item: PlaylistItem, e: React.MouseEvent) => {
    e.stopPropagation()
    onDownload(item)
  }, [onDownload])

  const handleCancelDownload = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onCancelDownload(id)
  }, [onCancelDownload])

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          const isSelected = selectedItem?.id === item.id
          const isDownloading = downloadingIds.has(item.id)
          const isDownloaded = isItemDownloaded(item.id)

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ItemRow
                item={item}
                contentType={contentType}
                isSelected={isSelected}
                isDownloading={isDownloading}
                isDownloaded={isDownloaded}
                progress={downloadProgress[item.id] || 0}
                onSelect={onSelectItem}
                onDownload={handleDownload}
                onCancelDownload={handleCancelDownload}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

interface ItemRowProps {
  item: PlaylistItem
  contentType: 'live' | 'movie' | 'series'
  isSelected: boolean
  isDownloading: boolean
  isDownloaded: boolean
  progress: number
  onSelect: (item: PlaylistItem) => void
  onDownload: (item: PlaylistItem, e: React.MouseEvent) => void
  onCancelDownload: (id: string, e: React.MouseEvent) => void
}

const ItemRow = memo(function ItemRow({
  item,
  contentType,
  isSelected,
  isDownloading,
  isDownloaded,
  progress,
  onSelect,
  onDownload,
  onCancelDownload,
}: ItemRowProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 group",
        isSelected 
          ? "bg-[oklch(0.269_0_0)]" 
          : "hover:bg-[oklch(0.269_0_0/0.5)] hover:translate-x-1"
      )}
    >
      {/* Channel/Movie Logo */}
      {item.tvgLogo ? (
        <img 
          src={item.tvgLogo} 
          alt="" 
          loading="lazy"
          className={cn(
            "rounded object-contain bg-[oklch(1_0_0/0.1)] shrink-0",
            contentType === 'live' ? "w-7 h-7" : "w-10 h-14 object-cover"
          )}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className={cn(
          "rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0",
          contentType === 'live' ? "w-7 h-7" : "w-10 h-14"
        )}>
          {contentType === 'live' ? (
            <Tv className="h-3.5 w-3.5 text-[oklch(0.556_0_0)]" />
          ) : (
            <Film className="h-4 w-4 text-[oklch(0.556_0_0)]" />
          )}
        </div>
      )}
      <button
        onClick={() => onSelect(item)}
        className="text-[oklch(0.985_0_0)] text-sm truncate flex-1 text-left"
      >
        {item.name}
      </button>
      
      {/* Download button for movies/series */}
      {(contentType === 'movie' || contentType === 'series') && (
        isDownloading ? (
          <div 
            className="relative shrink-0 cursor-pointer"
            onClick={(e) => onCancelDownload(item.id, e)}
            title="Click to cancel"
          >
            <PieProgress 
              progress={progress} 
              size={28}
            />
          </div>
        ) : isDownloaded ? (
          <CheckCircle2 className="h-4 w-4 text-[oklch(0.7_0.2_145)] shrink-0" />
        ) : (
          <button
            onClick={(e) => onDownload(item, e)}
            className="p-1.5 rounded-full hover:bg-[oklch(1_0_0/0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <Download className="h-4 w-4" />
          </button>
        )
      )}
      
      {contentType === 'live' && (
        <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
    </div>
  )
})

interface VirtualOfflineListProps {
  items: OfflineItem[]
  selectedItem: PlaylistItem | null
  onSelectItem: (item: PlaylistItem) => void
  onDeleteItem: (item: OfflineItem) => void
}

export const VirtualOfflineList = memo(function VirtualOfflineList({
  items,
  selectedItem,
  onSelectItem,
  onDeleteItem,
}: VirtualOfflineListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => MOVIE_ROW_HEIGHT,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <HardDrive className="h-10 w-10 text-[oklch(0.556_0_0)] mb-3 opacity-50" />
        <p className="text-[oklch(0.556_0_0)] text-sm">No offline content</p>
        <p className="text-[oklch(0.456_0_0)] text-xs mt-1">Download movies or series to watch offline</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          const isSelected = selectedItem?.id === item.id

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <OfflineRow
                item={item}
                isSelected={isSelected}
                onSelect={onSelectItem}
                onDelete={onDeleteItem}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

interface OfflineRowProps {
  item: OfflineItem
  isSelected: boolean
  onSelect: (item: PlaylistItem) => void
  onDelete: (item: OfflineItem) => void
}

const OfflineRow = memo(function OfflineRow({
  item,
  isSelected,
  onSelect,
  onDelete,
}: OfflineRowProps) {
  const handleSelect = useCallback(() => {
    onSelect({
      id: item.id,
      name: item.name,
      url: `file://${item.localPath}`,
      groupTitle: 'Offline',
      tvgLogo: item.thumbnail,
    })
  }, [item, onSelect])

  return (
    <div
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 group",
        isSelected 
          ? "bg-[oklch(0.269_0_0)]" 
          : "hover:bg-[oklch(0.269_0_0/0.5)]"
      )}
    >
      {item.thumbnail ? (
        <img 
          src={item.thumbnail} 
          alt="" 
          loading="lazy"
          className="w-10 h-14 rounded object-cover bg-[oklch(1_0_0/0.1)] shrink-0"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0">
          <Film className="h-4 w-4 text-[oklch(0.556_0_0)]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <button
          onClick={handleSelect}
          className="text-[oklch(0.985_0_0)] text-sm truncate block w-full text-left hover:text-[oklch(0.9_0_0)]"
        >
          {item.name}
        </button>
        <p className="text-[oklch(0.556_0_0)] text-xs mt-0.5">
          {item.type === 'movie' ? 'Movie' : 'Series'} • {item.size ? `${(item.size / 1024 / 1024).toFixed(0)} MB` : 'Unknown size'}
        </p>
      </div>
      <button
        onClick={() => onDelete(item)}
        className="p-1.5 rounded-full hover:bg-[oklch(1_0_0/0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.704_0.191_22.216)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
})
