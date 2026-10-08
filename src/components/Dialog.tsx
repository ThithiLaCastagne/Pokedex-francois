import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Dialog({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  wide?: boolean
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  const locked = useRef(busy)
  close.current = onClose
  locked.current = busy
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked.current) {
        event.preventDefault()
        close.current()
      }
      if (event.key !== 'Tab') return
      const items = [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled):not([hidden]),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        ) || []),
      ].filter((item) => item.getClientRects().length)
      const first = items[0],
        last = items.at(-1)
      if (!first) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel.current)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        className={`modal-panel ${wide ? 'wide-dialog' : 'compact-dialog'}`}
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <header className="modal-header">
          <div>
            {subtitle && <span className="eyebrow">{subtitle}</span>}
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fermer" onClick={onClose} disabled={busy}>
            <X size={21} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
