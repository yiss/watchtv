import { useEffect, useState, useCallback } from 'react'
import { Tv, Play, Radio } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { PlaylistItem, Category } from '@/types'

interface SpotlightSearchProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  items: PlaylistItem[]
  categories: Category[]
  onSelectItem: (item: PlaylistItem) => void
  onSelectCategory: (categoryId: string) => void
}

export function SpotlightSearch({
  isOpen,
  onOpenChange,
  items,
  categories,
  onSelectItem,
  onSelectCategory,
}: SpotlightSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Reset search when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!isOpen)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  const handleSelectItem = useCallback((item: PlaylistItem) => {
    onSelectItem(item)
    onOpenChange(false)
  }, [onSelectItem, onOpenChange])

  const handleSelectCategory = useCallback((categoryId: string) => {
    onSelectCategory(categoryId)
    onOpenChange(false)
  }, [onSelectCategory, onOpenChange])

  // Filter items based on search query
  const filteredItems = searchQuery.length > 0
    ? items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.groupTitle?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20) // Limit to 20 results for performance
    : []

  // Filter categories based on search query
  const filteredCategories = searchQuery.length > 0
    ? categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : categories.slice(0, 10) // Show first 10 categories when no search

  // Get recent/popular items when no search query
  const recentItems = searchQuery.length === 0 ? items.slice(0, 5) : []

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search channels, categories..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Show channels when searching */}
        {filteredItems.length > 0 && (
          <CommandGroup heading="Channels">
            {filteredItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`channel-${item.id}-${item.name}`}
                onSelect={() => handleSelectItem(item)}
                className="flex items-center gap-3"
              >
                {item.tvgLogo ? (
                  <img 
                    src={item.tvgLogo} 
                    alt="" 
                    className="w-8 h-8 rounded object-contain bg-[oklch(1_0_0_/_0.1)]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center">
                    <Tv className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.groupTitle && (
                    <p className="text-xs text-[oklch(0.556_0_0)] truncate">{item.groupTitle}</p>
                  )}
                </div>
                <Play className="h-4 w-4 text-[oklch(0.556_0_0)] opacity-0 group-data-[selected=true]:opacity-100" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Show categories */}
        {filteredCategories.length > 0 && (
          <CommandGroup heading={searchQuery ? "Categories" : "Browse Categories"}>
            {filteredCategories.map((cat) => (
              <CommandItem
                key={cat.id}
                value={`category-${cat.id}-${cat.name}`}
                onSelect={() => handleSelectCategory(cat.id)}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center">
                  <Radio className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                </div>
                <span className="text-sm">{cat.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Show recent items when not searching */}
        {recentItems.length > 0 && (
          <CommandGroup heading="Quick Access">
            {recentItems.map((item) => (
              <CommandItem
                key={`recent-${item.id}`}
                value={`recent-${item.id}-${item.name}`}
                onSelect={() => handleSelectItem(item)}
                className="flex items-center gap-3"
              >
                {item.tvgLogo ? (
                  <img 
                    src={item.tvgLogo} 
                    alt="" 
                    className="w-8 h-8 rounded object-contain bg-[oklch(1_0_0_/_0.1)]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-[oklch(0.269_0_0)] flex items-center justify-center">
                    <Tv className="h-4 w-4 text-[oklch(0.556_0_0)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  {item.groupTitle && (
                    <p className="text-xs text-[oklch(0.556_0_0)] truncate">{item.groupTitle}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      
      {/* Footer with keyboard hint */}
      <div className="border-t border-[oklch(1_0_0_/_0.1)] px-3 py-2 text-xs text-[oklch(0.556_0_0)] flex items-center justify-between">
        <span>Search for channels or categories</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-[oklch(0.269_0_0)] rounded text-[10px]">⌘</kbd>
          <kbd className="px-1.5 py-0.5 bg-[oklch(0.269_0_0)] rounded text-[10px]">K</kbd>
          <span className="ml-1">to toggle</span>
        </div>
      </div>
    </CommandDialog>
  )
}
