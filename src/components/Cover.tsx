import { useImage } from '../store'
import { ENTRY_LABEL, type Entry } from '../lib/types'

const GRADS = [
  'linear-gradient(160deg,#2b5cff,#050a1f)',
  'linear-gradient(160deg,#00b2ff,#001b2e)',
  'linear-gradient(160deg,#1a1a24,#3d6bff)',
  'linear-gradient(160deg,#8fb0ff,#0b1440)',
  'linear-gradient(160deg,#0f2a8a,#000000)',
]
const gradFor = (s: string) => GRADS[Math.abs([...s].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % GRADS.length]

/** Capa do registro: imagem local, ou um bloco tipográfico em degradê quando não há imagem. */
export function Cover({ entry }: { entry: Entry }) {
  const url = useImage(entry.imageId)
  if (url) return <img src={url} alt="" loading="lazy" />
  return (
    <div className="cover-ph" style={{ ['--ph-bg' as string]: gradFor(entry.title) }}>
      <small>{ENTRY_LABEL[entry.type].one}</small>
      <b>{entry.title}</b>
    </div>
  )
}
