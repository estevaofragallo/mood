import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import type { Reading } from '../lib/types'

export function ReadingEditor({ reading, onSave, onClose }: { reading: Reading; onSave: (r: Reading) => void; onClose: () => void }) {
  const [name, setName] = useState(reading.name)
  const [words, setWords] = useState(reading.words.join(', '))
  const [palette, setPalette] = useState(reading.palette)
  const [summary, setSummary] = useState(reading.summary)

  const save = () =>
    onSave({
      ...reading,
      name: name.trim().toLowerCase() || reading.name,
      words: words.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 4),
      palette,
      summary: summary.trim(),
      edited: true,
    })

  return (
    <Sheet title="editar leitura" onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <p className="note" style={{ margin: 0 }}>a leitura é uma sugestão. a palavra final é sua.</p>
        <label className="field">
          <span>nome da fase</span>
          <input className="input serif" style={{ fontSize: 'calc(24px * var(--display-scale))' }} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>palavras (separadas por vírgula, até 4)</span>
          <input className="input" value={words} onChange={(e) => setWords(e.target.value)} />
        </label>
        <div className="field">
          <span>paleta</span>
          <div className="row" style={{ gap: 10 }}>
            {palette.map((c, i) => (
              <label key={i} style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,.25)', cursor: 'pointer', boxShadow: `0 0 20px ${c}55` }}>
                <input
                  type="color"
                  value={c}
                  aria-label={`cor ${i + 1}`}
                  onChange={(e) => setPalette((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </label>
            ))}
          </div>
        </div>
        <label className="field">
          <span>resumo</span>
          <textarea className="input" maxLength={240} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <button className="btn primary block" onClick={save}>salvar leitura</button>
      </div>
    </Sheet>
  )
}
