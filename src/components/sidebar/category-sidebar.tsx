import { forwardRef, useMemo } from 'react'
import { motion } from 'motion/react'
import { Search, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PlaylistItem, Category } from '@/types'
import { OfflineItem } from '@/lib/storage'
import { VirtualCategoryList, VirtualItemList, VirtualOfflineList } from './virtual-list'

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

    // Filter items/categories by search (memoized for performance)
    const filteredItems = useMemo(() => {
      if (!searchQuery) return items
      const query = searchQuery.toLowerCase()
      return items.filter(i => i.name.toLowerCase().includes(query))
    }, [items, searchQuery])

    const filteredCategories = useMemo(() => {
      if (!searchQuery) return categories
      const query = searchQuery.toLowerCase()
      return categories.filter(c => c.name.toLowerCase().includes(query))
    }, [categories, searchQuery])

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
          
          {/* Virtualized Scrollable List */}
          <div className="flex-1 min-h-0 px-2 pb-2">
            {(isLoading || sidebarLoading) ? (
              <LoadingState isLoading={isLoading} />
            ) : loadError ? (
              <ErrorState error={loadError} />
            ) : activeTab === 'offline' ? (
              <VirtualOfflineList
                items={offlineItems}
                selectedItem={selectedItem}
                onSelectItem={onSelectItem}
                onDeleteItem={onDeleteOfflineItem}
              />
            ) : selectedCategory ? (
              <VirtualItemList
                items={filteredItems}
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
              <VirtualCategoryList
                categories={filteredCategories}
                onSelectCategory={onSelectCategory}
              />
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
