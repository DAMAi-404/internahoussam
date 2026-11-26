import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Visually hidden title (still announced) when the content has its own heading. */
  hideTitle?: boolean
  children: ReactNode
  footer?: ReactNode
}

/**
 * Bottom sheet (vaul): drag to dismiss, grabber, spring motion.
 * Always the light surface, even inside the labo night theme (DESIGN_SYSTEM principle 7).
 */
export function Sheet({ open, onClose, title, hideTitle, children, footer }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" />
        <Drawer.Content
          className="surface-light fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-sheet outline-none"
          aria-describedby={undefined}
        >
          <div className="mx-auto mb-1 mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-ink/20" aria-hidden />
          <Drawer.Title className={clsx('px-5 pt-2 text-sheet font-semibold', hideTitle && 'sr-only')}>{title}</Drawer.Title>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3">{children}</div>
          {footer && <div className="safe-bottom shrink-0 border-t border-line px-5 pb-4 pt-3">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
