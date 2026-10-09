import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn sm" onClick={onClose} aria-label="fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}
