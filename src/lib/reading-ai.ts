import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { ENTRY_LABEL } from './types'
import { loadSettings } from './settings'
import { ReadingError, isHexColor as isHex, localReading, type ReadingInput } from './reading'
import type { Reading } from './types'

/* ───────────────────────── Claude ───────────────────────── */

const ReadingSchema = z.object({
  name: z.string().describe('nome da fase, 2 a 5 palavras, minúsculas'),
  words: z.array(z.string()).describe('3 ou 4 palavras ou expressões curtas'),
  palette: z.array(z.string()).describe('5 cores em hex #rrggbb'),
  summary: z.string().describe('uma ou duas frases, até 220 caracteres'),
})

const SYSTEM = `Você escreve a "leitura de humor" do moody, um app de recaps culturais por período.
A partir do que a pessoa ouviu, leu, assistiu, por onde passou e das cores das fotos, você descreve QUEM ELA FOI naquele intervalo — um retrato datado, nunca um rótulo permanente.

Tom: editorial, sensorial, com a atmosfera de um blog tumblr de 2009 cruzado com estética y2k (cromado, vidro, flash, grão). Português do Brasil, tudo em minúsculas.

Saída:
- name: nome da fase, 2 a 5 palavras (ex.: "inverno em vidro fosco", "fase lilás de fones").
- words: 3 ou 4 palavras ou expressões curtas.
- palette: 5 cores hex que traduzam o período; parta das cores das fotos quando houver, ajustando para funcionar sobre fundo preto.
- summary: 1 ou 2 frases, no máximo 220 caracteres. Se houver fase anterior, descreva a mudança.

Limites, obrigatórios:
- Use apenas vocabulário estético e emocional.
- Nunca infira nem sugira religião, posição política, orientação sexual, gênero, saúde, etnia, classe social ou tipo de personalidade, mesmo que as obras pareçam indicar.
- Não faça diagnósticos nem julgamentos sobre a pessoa; descreva o período.`

function describeInput({ period, entries, imageColors, previous }: ReadingInput): string {
  const lines = entries
    .filter((e) => e.type !== 'photo')
    .map((e) => {
      const nota = typeof e.rating === 'number' ? ` · nota ${e.rating}/5` : ''
      const frase = e.note ? ` · "${e.note}"` : ''
      return `- [${ENTRY_LABEL[e.type].one}] ${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}${e.year ? ` (${e.year})` : ''}${nota}${frase}`
    })
  const photos = entries.filter((e) => e.type === 'photo').length
  return [
    `período: ${period.title} (${period.start} a ${period.end})`,
    '',
    'registros:',
    lines.length ? lines.join('\n') : '- (nenhum item de mídia)',
    `fotos: ${photos}`,
    imageColors.length ? `cores extraídas das fotos e capas: ${imageColors.join(', ')}` : '',
    previous ? `\nfase anterior: "${previous.reading.name}" (${previous.title}) — palavras: ${previous.reading.words.join(', ')}` : '',
  ].join('\n')
}

export async function aiReading(input: ReadingInput): Promise<Reading> {
  const { apiKey, model } = loadSettings()
  if (!apiKey) throw new ReadingError('sem chave da API')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })

  try {
    const res = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: describeInput(input) }],
      output_config: { effort: 'low', format: zodOutputFormat(ReadingSchema) },
    })
    if (res.stop_reason === 'refusal') throw new ReadingError('a IA recusou esta leitura')
    const out = res.parsed_output
    if (!out) throw new ReadingError('resposta da IA fora do formato')

    const fallback = localReading(input)
    const palette = out.palette.filter(isHex).slice(0, 5)
    while (palette.length < 5) palette.push(fallback.palette[palette.length])
    return {
      name: out.name.toLowerCase().trim() || fallback.name,
      words: out.words.map((w) => w.toLowerCase().trim()).filter(Boolean).slice(0, 4),
      palette,
      summary: out.summary.trim().toLowerCase(),
      origin: 'ai',
      edited: false,
      generatedAt: Date.now(),
    }
  } catch (err) {
    if (err instanceof ReadingError) throw err
    if (err instanceof Anthropic.AuthenticationError) throw new ReadingError('chave da API inválida')
    if (err instanceof Anthropic.RateLimitError) throw new ReadingError('limite de uso da API atingido; tente em instantes')
    if (err instanceof Anthropic.APIConnectionError) throw new ReadingError('sem conexão com a API')
    if (err instanceof Anthropic.APIError) throw new ReadingError(`erro da API (${err.status ?? '?'})`)
    throw new ReadingError('não foi possível gerar a leitura')
  }
}
