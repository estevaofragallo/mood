import { Icon } from './Icon'

/** Nota de 0 a 5 em meias estrelas. Toque na metade esquerda de uma estrela para meia nota. */
export function Rating({ value, onChange }: { value?: number; onChange?: (v: number | undefined) => void }) {
  const v = value ?? 0
  const set = (n: number) => onChange?.(n === value ? undefined : n)
  return (
    <div className={`rating${onChange ? '' : ' static'}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`nota ${v} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)))
        return (
          <button
            key={i}
            type="button"
            tabIndex={onChange ? 0 : -1}
            aria-label={`${i} estrelas`}
            onClick={(e) => {
              if (!onChange) return
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              set(e.clientX - r.left < r.width / 2 ? i - 0.5 : i)
            }}
          >
            <Icon name="star" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="fill" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}>
                <Icon name="star" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
