import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { loadSettings } from './settings'
import { today } from './periods'
import { ENTRY_LABEL, type Entry } from './types'
import type { Profile } from './profile'
import { moodLabel, type AstroContext, type Daily, type MoodId, type PickType } from './daily'

const PickSchema = z.object({
  type: z.enum(['album', 'film', 'series', 'book']),
  title: z.string().describe('título como é conhecido no Brasil'),
  creator: z.string().describe('artista, direção, criação ou autoria'),
  year: z.string(),
  why: z.string().describe('uma frase, até 160 caracteres, ligando a obra ao gosto e ao humor da pessoa'),
})
const DailySchema = z.object({ pick: PickSchema, alternates: z.array(PickSchema).describe('exatamente 2 alternativas') })

const SYSTEM = `Você é a curadoria diária do moody, um app de recaps culturais. Indique UMA obra (álbum, filme, série ou livro) para hoje e duas alternativas.

Regras:
- Só obras reais, que existem, com título, autoria e ano corretos. Na dúvida, escolha outra.
- Nunca indique algo da lista "não indicar".
- Parta do gosto da pessoa (favoritos e registros com notas), mas não fique no óbvio: aproxime por clima, textura, ritmo, tema.
- O humor do dia, quando houver, pesa na escolha.
- Se houver contexto astrológico, use-o como tom e atmosfera (ex.: lua nova pede recomeço; lua cheia, intensidade), nunca como previsão sobre saúde, dinheiro, trabalho ou relações.
- Vocabulário estético e emocional; não rotule a pessoa (nada de religião, política, sexualidade, gênero, saúde, etnia ou tipo de personalidade).
- Português do Brasil, minúsculas no texto de "why".`

export async function aiDaily(opts: {
  mood?: MoodId
  want: PickType | 'any'
  skip: Set<string>
  skipTitles: string[]
  profile: Profile | null
  entries: Entry[]
  astro: AstroContext | null
  round: number
}): Promise<Daily> {
  const { apiKey, model } = loadSettings()
  if (!apiKey) throw new Error('sem chave')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })

  const favs = opts.profile?.favorites.map((f) => `- [${ENTRY_LABEL[f.type].one}] ${f.title}${f.subtitle ? ` — ${f.subtitle}` : ''}`) ?? []
  const recent = opts.entries
    .filter((e) => e.type !== 'photo' && e.type !== 'place')
    .slice(0, 25)
    .map((e) => `- [${ENTRY_LABEL[e.type].one}] ${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}${typeof e.rating === 'number' ? ` · nota ${e.rating}/5` : ''}`)
  const a = opts.astro
  const content = [
    `data: ${today()}`,
    `tipo desejado: ${opts.want === 'any' ? 'qualquer (varie)' : ENTRY_LABEL[opts.want].one}`,
    `humor de hoje: ${moodLabel(opts.mood) ?? 'não informado'}`,
    a ? `céu: ${a.sky.phase} em ${a.sky.moonSign}; sol natal em ${a.natal.sun}, lua natal em ${a.natal.moon}${a.natal.moonAlt ? ` (ou ${a.natal.moonAlt})` : ''}${a.sky.transits.length ? `; ${a.sky.transits.join('; ')}` : ''}` : '',
    '',
    'favoritos (definem a pessoa):',
    favs.length ? favs.join('\n') : '- (nenhum)',
    '',
    'registros recentes:',
    recent.length ? recent.join('\n') : '- (nenhum)',
    '',
    `não indicar: ${opts.skipTitles.slice(0, 120).join('; ') || '(nada)'}`,
  ].filter((l) => l !== '').join('\n')

  const res = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(DailySchema) },
  })
  if (res.stop_reason === 'refusal') throw new Error('recusa')
  const out = res.parsed_output
  if (!out) throw new Error('formato')
  const clean = <T extends { why: string }>(p: T) => ({ ...p, why: p.why.trim().toLowerCase() })
  const all = [out.pick, ...out.alternates].filter((p) => !opts.skip.has(p.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')))
  if (!all.length) throw new Error('só repetidos')
  return {
    date: today(),
    mood: opts.mood,
    want: opts.want,
    pick: clean(all[0]),
    alternates: all.slice(1, 3).map(clean),
    sky: a?.line,
    origin: 'ai',
    round: opts.round,
  }
}
