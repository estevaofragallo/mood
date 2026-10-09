import { useImage } from '../store'
import { ENTRY_LABEL, type Entry } from '../lib/types'

const GRADS = [
  'linear-gradient(135deg,#8c74ff,#ff9ecf)',
  'linear-gradient(135deg,#5fb8ff,#c9b6ff)',
  'linear-gradient(135deg,#ff7ec2,#ffd3a8)',
  'linear-gradient(135deg,#2f3a55,#9fd8ff)',
  'linear-gradient(135deg,#6b5b95,#d7ff5a)',
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
