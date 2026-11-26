import clsx from 'clsx'
import type { ReactNode } from 'react'

/** App screen: fixed header, scrolling body, optional bottom bar. Uses the full dynamic viewport. */
export function Screen({ header, children, footer, className }: { header: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className={clsx('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}>{children}</div>
      {footer && <div className="safe-bottom shrink-0 border-t border-[var(--surface-line)] bg-card px-4 pb-3 pt-3 text-fg">{footer}</div>}
    </div>
  )
}
