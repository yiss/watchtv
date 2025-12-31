import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { Plus, Pencil, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Playlist } from '@/types'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface PlaylistSidebarProps {
  playlists: Playlist[]
  currentPlaylistId: string
  onSelectPlaylist: (id: string) => void
  onAddPlaylist: () => void
  onEditPlaylist: (playlist: Playlist) => void
  onDeletePlaylist: (e: React.MouseEvent, id: string) => void
}

export const PlaylistSidebar = forwardRef<HTMLDivElement, PlaylistSidebarProps>(
  function PlaylistSidebar(props, ref) {
    const {
      playlists,
      currentPlaylistId,
      onSelectPlaylist,
      onAddPlaylist,
      onEditPlaylist,
      onDeletePlaylist,
    } = props

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
          {/* Header with Add Button */}
          <div className="p-3 shrink-0 flex justify-end">
            <button
              onClick={onAddPlaylist}
              className="w-9 h-9 flex items-center justify-center bg-[oklch(0.269_0_0)] hover:bg-[oklch(0.3_0_0)] hover:scale-105 active:scale-95 rounded-full text-[oklch(0.985_0_0)] transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Playlist List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-2 pb-2 space-y-1.5">
              {playlists.map((p, index) => (
                <PlaylistItem
                  key={p.id}
                  playlist={p}
                  isActive={p.id === currentPlaylistId}
                  index={index}
                  onSelect={() => onSelectPlaylist(p.id)}
                  onEdit={() => onEditPlaylist(p)}
                  onDelete={(e) => onDeletePlaylist(e, p.id)}
                />
              ))}
              
              {playlists.length === 0 && (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-8"
                >
                  <p className="text-[oklch(0.556_0_0)] text-sm">No playlists yet</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }
)

interface PlaylistItemProps {
  playlist: Playlist
  isActive: boolean
  index: number
  onSelect: () => void
  onEdit: () => void
  onDelete: (e: React.MouseEvent) => void
}

function PlaylistItem({ playlist, isActive, index, onSelect, onEdit, onDelete }: PlaylistItemProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 text-left group cursor-pointer animate-scale-in",
        isActive 
          ? "bg-[oklch(0.269_0_0)]" 
          : "hover:bg-[oklch(0.269_0_0/0.5)] hover:translate-x-1"
      )}
      style={{ animationDelay: `${Math.min(index * 50, 300)}ms`, animationFillMode: 'backwards' }}
      onClick={onSelect}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[oklch(0.985_0_0)] text-sm truncate">
          {playlist.name}
        </p>
        <p className="text-[oklch(0.556_0_0)] text-xs mt-0.5">
          Updated {new Date(playlist.updatedAt).toLocaleDateString()}
        </p>
      </div>
      
      {/* Three-dot Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-full hover:bg-[oklch(1_0_0/0.15)] text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete(e as any)
            }}
            className="text-[oklch(0.704_0.191_22.216)]"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
