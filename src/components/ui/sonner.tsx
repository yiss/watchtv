import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        style: {
          background: 'oklch(0.145 0 0 / 0.95)',
          border: '1px solid oklch(1 0 0 / 0.1)',
          color: 'oklch(0.985 0 0)',
          backdropFilter: 'blur(12px)',
        },
        classNames: {
          toast: 'rounded-xl shadow-2xl',
          title: 'text-sm font-medium',
          description: 'text-xs text-[oklch(0.556_0_0)]',
          actionButton: 'bg-[oklch(0.488_0.243_264.376)] text-white text-xs px-2 py-1 rounded-md',
          cancelButton: 'bg-[oklch(0.269_0_0)] text-white text-xs px-2 py-1 rounded-md',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
