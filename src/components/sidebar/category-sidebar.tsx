import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { 
  Search, 
  ChevronRight, 
  Tv, 
  Film, 
  Loader2, 
  AlertCircle,
  Download,
  HardDrive,
  Trash2,
  CheckCircle2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PlaylistItem, Category } from '@/types'
import { OfflineItem } from '@/lib/storage'
import { PieProgress } from '@/components/ui/download-toast'

interface CategorySidebarProps {
  isVisible: boolean
  isLoading: boolean
  sidebarLoading: boolean
  loadError: string | null
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string | null
  onBackToCategories: () => void
  activeTab: 'live' | 'movie' | 'series' | 'offline'
  contentType: 'live' | 'movie' | 'series'
  categories: Category[]
  items: PlaylistItem[]
  offlineItems: OfflineItem[]
  selectedItem: PlaylistItem | null
  onSelectCategory: (categoryId: string) => void
  onSelectItem: (item: PlaylistItem) => void
  onDownload: (item: PlaylistItem) => void
  onCancelDownload: (id: string) => void
  onDeleteOfflineItem: (item: OfflineItem) => void
  downloadingIds: Set<string>
  downloadProgress: Record<string, number>
  isItemDownloaded: (id: string) => boolean
}

export const CategorySidebar = forwardRef<HTMLDivElement, CategorySidebarProps>(
  function CategorySidebar(props, ref) {
    const {
      isLoading,
      sidebarLoading,
      loadError,
      searchQuery,
      onSearchChange,
      selectedCategory,
      onBackToCategories,
      activeTab,
      contentType,
      categories,
      items,
      offlineItems,
      selectedItem,
      onSelectCategory,
      onSelectItem,
      onDownload,
      onCancelDownload,
      onDeleteOfflineItem,
      downloadingIds,
      downloadProgress,
      isItemDownloaded,
    } = props

    // Filter items/categories by search
    const displayItems = selectedCategory
      ? searchQuery
        ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : items
      : searchQuery
        ? categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : categories

    return (
      <motion.div 
        ref={ref}
        initial={{ x: -380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -380, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute top-1 left-2 bottom-4 w-[380px] z-30"
      >
        <div className="h-full flex flex-col bg-[oklch(0.145_0_0/0.9)] backdrop-blur-xl rounded-2xl border border-[oklch(1_0_0/0.1)] overflow-hidden">
          {/* Search Box */}
          <div className="p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[oklch(0.556_0_0)]" />
              <Input 
                placeholder="Search" 
                className="pl-9 h-9 bg-[oklch(0.269_0_0)] border-0 rounded-lg text-[oklch(0.985_0_0)] placeholder:text-[oklch(0.556_0_0)] focus-visible:ring-1 focus-visible:ring-[oklch(1_0_0/0.3)] text-sm" 
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Back Button (when viewing items) */}
          {selectedCategory && (
            <button
              onClick={onBackToCategories}
              className="mx-3 mb-2 flex items-center gap-2 text-sm text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors shrink-0"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back to categories
            </button>
          )}
          
          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {(isLoading || sidebarLoading) ? (
              <LoadingState isLoading={isLoading} />
            ) : loadError ? (
              <ErrorState error={loadError} />
            ) : (
              <div className="px-2 pb-2 space-y-0.5">
                {activeTab === 'offline' ? (
                  <OfflineContent
                    items={offlineItems}
                    selectedItem={selectedItem}
                    onSelectItem={onSelectItem}
                    onDeleteItem={onDeleteOfflineItem}
                  />
                ) : selectedCategory ? (
                  <ItemList
                    items={displayItems as PlaylistItem[]}
                    contentType={contentType}
                    selectedItem={selectedItem}
                    onSelectItem={onSelectItem}
                    onDownload={onDownload}
                    onCancelDownload={onCancelDownload}
                    downloadingIds={downloadingIds}
                    downloadProgress={downloadProgress}
                    isItemDownloaded={isItemDownloaded}
                  />
                ) : (
                  <CategoryList
                    categories={displayItems as Category[]}
                    onSelectCategory={onSelectCategory}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }
)

function LoadingState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Loader2 className="h-8 w-8 text-[oklch(0.556_0_0)] animate-spin mb-3" />
      <p className="text-[oklch(0.556_0_0)] text-sm">
        {isLoading ? 'Loading playlist...' : 'Loading content...'}
      </p>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      <AlertCircle className="h-8 w-8 text-[oklch(0.704_0.191_22.216)] mb-3" />
      <p className="text-[oklch(0.556_0_0)] text-sm text-center">{error}</p>
    </div>
  )
}

interface OfflineContentProps {
  items: OfflineItem[]
  selectedItem: PlaylistItem | null
  onSelectItem: (item: PlaylistItem) => void
  onDeleteItem: (item: OfflineItem) => void
}

function OfflineContent({ items, selectedItem, onSelectItem, onDeleteItem }: OfflineContentProps) {
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
    <>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 animate-scale-in group",
            selectedItem?.id === item.id 
              ? "bg-[oklch(0.269_0_0)]" 
              : "hover:bg-[oklch(0.269_0_0/0.5)]"
          )}
          style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
        >
          {item.thumbnail ? (
            <img 
              src={item.thumbnail} 
              alt="" 
              className="w-10 h-14 rounded object-cover bg-[oklch(1_0_0/0.1)] shrink-0"
            />
          ) : (
            <div className="w-10 h-14 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center shrink-0">
              <Film className="h-4 w-4 text-[oklch(0.556_0_0)]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onSelectItem({
                id: item.id,
                name: item.name,
                url: `file://${item.localPath}`,
                groupTitle: 'Offline',
                tvgLogo: item.thumbnail,
              })}
              className="text-[oklch(0.985_0_0)] text-sm truncate block w-full text-left hover:text-[oklch(0.9_0_0)]"
            >
              {item.name}
            </button>
            <p className="text-[oklch(0.556_0_0)] text-xs mt-0.5">
              {item.type === 'movie' ? 'Movie' : 'Series'} • {item.size ? `${(item.size / 1024 / 1024).toFixed(0)} MB` : 'Unknown size'}
            </p>
          </div>
          <button
            onClick={() => onDeleteItem(item)}
            className="p-1.5 rounded-full hover:bg-[oklch(1_0_0/0.1)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.704_0.191_22.216)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </>
  )
}

interface ItemListProps {
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

function ItemList({
  items,
  contentType,
  selectedItem,
  onSelectItem,
  onDownload,
  onCancelDownload,
  downloadingIds,
  downloadProgress,
  isItemDownloaded,
}: ItemListProps) {
  return (
    <>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 animate-scale-in group",
            selectedItem?.id === item.id 
              ? "bg-[oklch(0.269_0_0)]" 
              : "hover:bg-[oklch(0.269_0_0/0.5)] hover:translate-x-1"
          )}
          style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
        >
          {/* Channel/Movie Logo */}
          {item.tvgLogo ? (
            <img 
              src={item.tvgLogo} 
              alt="" 
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
            onClick={() => onSelectItem(item)}
            className="text-[oklch(0.985_0_0)] text-sm truncate flex-1 text-left"
          >
            {item.name}
          </button>
          
          {/* Download button for movies/series */}
          {(contentType === 'movie' || contentType === 'series') && (
            downloadingIds.has(item.id) ? (
              <div 
                className="relative shrink-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancelDownload(item.id)
                }}
                title="Click to cancel"
              >
                <PieProgress 
                  progress={downloadProgress[item.id] || 0} 
                  size={28}
                />
              </div>
            ) : isItemDownloaded(item.id) ? (
              <CheckCircle2 className="h-4 w-4 text-[oklch(0.7_0.2_145)] shrink-0" />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDownload(item)
                }}
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
      ))}
    </>
  )
}

interface CategoryListProps {
  categories: Category[]
  onSelectCategory: (categoryId: string) => void
}

function CategoryList({ categories, onSelectCategory }: CategoryListProps) {
  return (
    <>
      {categories.map((cat, index) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[oklch(0.269_0_0/0.5)] hover:translate-x-1 transition-all duration-200 text-left animate-scale-in"
          style={{ animationDelay: `${Math.min(index * 20, 300)}ms`, animationFillMode: 'backwards' }}
        >
          <span className="text-[oklch(0.985_0_0)] text-sm truncate flex-1">
            {cat.name}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-[oklch(0.556_0_0)] shrink-0" />
        </button>
      ))}
    </>
  )
}
