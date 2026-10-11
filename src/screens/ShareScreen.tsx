import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { renderRecap, type CardFormat } from '../lib/card'
import { localReading } from '../lib/reading'
import type { Period } from '../lib/types'

export function ShareScreen({ period, back }: { period: Period; back: () => void }) {
  const { entriesOf } = useStore()
  const toast = useToast()
  const [format, setFormat] = useState<CardFormat>('story')
  const [blobs, setBlobs] = useState<Blob[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [busy, setBusy] = useState(true)

  const entries = entriesOf(period)

  useEffect(() => {
    let alive = true
    setBusy(true)
    const reading = period.reading ?? localReading({ period, entries, imageColors: [] })
    renderRecap(format, period, reading, entries)
      .then((b) => {
        if (!alive) return
        setBlobs(b)
        setUrls(b.map((x) => URL.createObjectURL(x)))
      })
      .catch(() => toast('não foi possível montar o card'))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, period])

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  const slug = period.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  const files = () => blobs.map((b, i) => new File([b], `moody-${slug}-${format === 'story' ? 'stories' : `carrossel-${i + 1}`}.png`, { type: 'image/png' }))

  async function shareNative() {
    const f = files()
    if (navigator.canShare?.({ files: f })) {
      try {
        await navigator.share({ files: f, title: period.reading?.name ?? period.title })
      } catch {
        /* cancelado */
      }
    } else download()
  }

  function download() {
    files().forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(f)
        a.download = f.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      }, i * 250)
    })
    toast(blobs.length > 1 ? `${blobs.length} imagens salvas` : 'imagem salva')
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={back} aria-label="voltar"><Icon name="back" size={20} /></button>
        <span className="title">compartilhar</span>
        <span style={{ width: 44 }} />
      </header>

      <div className="segmented" style={{ marginBottom: 20 }}>
        <button className={format === 'story' ? 'on' : ''} onClick={() => setFormat('story')}>stories · 9:16</button>
        <button className={format === 'carousel' ? 'on' : ''} onClick={() => setFormat('carousel')}>carrossel · 4:5</button>
      </div>

      {busy ? (
        <div className="glass" style={{ aspectRatio: format === 'story' ? '9 / 16' : '4 / 5', width: format === 'story' ? 'min(78%, 300px)' : 'min(84%, 340px)', margin: '0 auto', borderRadius: 22, display: 'grid', placeItems: 'center' }}>
          <span className="pending"><i /><i /><i /></span>
        </div>
      ) : (
        <div className={`preview ${format}`} style={{ justifyContent: urls.length === 1 ? 'center' : 'flex-start' }}>
          {urls.map((u, i) => <img key={u} src={u} alt={`slide ${i + 1}`} />)}
        </div>
      )}
      {format === 'carousel' && urls.length > 1 && <p className="note" style={{ textAlign: 'center' }}>{urls.length} slides · deslize para ver</p>}

      <div className="stack" style={{ marginTop: 20 }}>
        <button className="btn plus light block" style={{ justifyContent: 'space-between' }} disabled={busy} onClick={shareNative}>
          enviar para o instagram <span className="plus-dot"><Icon name="share" size={18} /></span>
        </button>
        <button className="btn glassy block" disabled={busy} onClick={download}>
          <Icon name="download" size={18} /> salvar no aparelho
        </button>
        <p className="note" style={{ textAlign: 'center', margin: 0 }}>o card é montado no seu aparelho. nenhuma foto é enviada a servidores.</p>
      </div>
    </div>
  )
}
