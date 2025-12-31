import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle } from 'lucide-react'

interface UnavailableMessageProps {
  message: string | null
  onDismiss: () => void
}

export function UnavailableMessage({ message, onDismiss }: UnavailableMessageProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-[oklch(0.205_0_0)] border border-[oklch(1_0_0/0.1)] rounded-xl px-5 py-3 shadow-xl backdrop-blur-xl flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-[oklch(0.708_0_0)]" />
            <span className="text-[oklch(0.985_0_0)] text-sm">{message}</span>
            <button 
              onClick={onDismiss}
              className="ml-2 text-[oklch(0.556_0_0)] hover:text-[oklch(0.985_0_0)] transition-colors"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
