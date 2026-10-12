/** Abre a folha de compartilhamento do sistema; sem suporte, baixa os arquivos. Retorna o que aconteceu. */
export async function shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  download(files)
  return 'downloaded'
}

export function download(files: File[]) {
  files.forEach((f, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(f)
      a.download = f.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, i * 250)
  })
}

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
