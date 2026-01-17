import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const TooltipContext = React.createContext<TooltipContextValue | undefined>(undefined)

function useTooltipContext() {
  const context = React.useContext(TooltipContext)
  if (!context) {
    throw new Error('Tooltip components must be used within a TooltipProvider')
  }
  return context
}

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement>(null)

  return (
    <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, ref) => {
    const { setOpen, triggerRef } = useTooltipContext()

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      setOpen(true)
      onMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      setOpen(false)
      onMouseLeave?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
      setOpen(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
      setOpen(false)
      onBlur?.(e)
    }

    const combinedRef = (node: HTMLElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{
        ref?: React.Ref<HTMLElement>
        onMouseEnter?: React.MouseEventHandler<HTMLElement>
        onMouseLeave?: React.MouseEventHandler<HTMLElement>
        onFocus?: React.FocusEventHandler<HTMLElement>
        onBlur?: React.FocusEventHandler<HTMLElement>
      }>, {
        ref: combinedRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
      })
    }

    return (
      <span
        ref={combinedRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      >
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = 'TooltipTrigger'

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', sideOffset = 4, children, ...props }, ref) => {
    const { open, triggerRef } = useTooltipContext()
    const [position, setPosition] = React.useState({ top: 0, left: 0 })
    const contentRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      if (open && triggerRef.current && contentRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const contentRect = contentRef.current.getBoundingClientRect()

        let top = 0
        let left = 0

        switch (side) {
          case 'top':
            top = triggerRect.top - contentRect.height - sideOffset
            left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
            break
          case 'bottom':
            top = triggerRect.bottom + sideOffset
            left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
            break
          case 'left':
            top = triggerRect.top + (triggerRect.height - contentRect.height) / 2
            left = triggerRect.left - contentRect.width - sideOffset
            break
          case 'right':
            top = triggerRect.top + (triggerRect.height - contentRect.height) / 2
            left = triggerRect.right + sideOffset
            break
        }

        setPosition({ top, left })
      }
    }, [open, side, sideOffset, triggerRef])

    if (!open) return null

    return (
      <div
        ref={(node) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        className={cn(
          'fixed z-50 overflow-hidden rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-foreground shadow-md animate-in fade-in-0 zoom-in-95',
          className
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
