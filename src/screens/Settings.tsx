import { useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { DEFAULT_MODEL, loadSettings, saveSettings } from '../lib/settings'
import { THEMES, THEME_ORDER, applyTheme, loadThemeId } from '../lib/theme'

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', hint: 'leituras mais finas (padrão)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', hint: 'equilíbrio entre custo e qualidade' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', hint: 'mais rápido e barato' },
]

export function Settings({ editProfile }: { editProfile: (at: 'book' | 'mode') => void }) {
  const { entries, periods, wipe, profile, saveProfile } = useStore()
  const [confirmBirth, setConfirmBirth] = useState(false)
  const [themeId, setThemeId] = useState(loadThemeId)
  const toast = useToast()
  const [s, setS] = useState(loadSettings)
  const [confirm, setConfirm] = useState(false)

  const update = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch }
    setS(next)
    saveSettings(next)
  }

  function exportJson() {
    const data = JSON.stringify({ app: 'moody', version: 1, exportedAt: new Date().toISOString(), profile, periods, entries }, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    a.download = 'moody-backup.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="title">ajustes</span>
      </header>

      <section className="glass card stack" style={{ gap: 10, marginBottom: 'var(--s8)' }}>
        <div className="row between">
          <b>visual</b>
          <span className="tag">{THEMES[themeId].name}</span>
        </div>
        {THEME_ORDER.map((id) => {
          const t = THEMES[id]
          return (
            <button key={id} className={`theme-opt${themeId === id ? ' on' : ''}`} onClick={() => { applyTheme(id, true); setThemeId(id) }} aria-pressed={themeId === id}>
              <span className="sample" style={{ borderRadius: t.radius.md, color: t.color.accent }}>
                <span style={{ fontFamily: `'${t.fonts.display}'`, fontWeight: t.display.weight, fontStretch: t.display.stretch }}>{t.display.upper ? 'AA' : 'Aa'}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontFamily: `'${t.fonts.display}'`, fontWeight: t.display.weight, fontStretch: t.display.stretch, fontSize: 20 * t.display.scale + 4, textTransform: t.display.upper ? 'uppercase' : 'none' }}>{t.name}</b>
                <small className="faint" style={{ display: 'block' }}>{t.blurb}</small>
                <small style={{ fontFamily: `'${t.fonts.num}'`, color: t.color.accent2, fontSize: 15 }}>10.10.26 · 07 reg.</small>
              </span>
            </button>
          )
        })}
      </section>

      {profile && (
        <section className="glass card stack" style={{ gap: 14, marginBottom: 'var(--s8)' }}>
          <div className="row between">
            <b>seu perfil</b>
            <span className="tag"><span className="sparkle">✦</span> {profile.mode === 'astral' ? 'modo astral' : 'gosto e humor'}</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {profile.favorites.length ? `${profile.favorites.length} favoritos: ${profile.favorites.map((f) => f.title).slice(0, 4).join(', ')}${profile.favorites.length > 4 ? '…' : ''}` : 'nenhum favorito ainda.'}
          </p>
          {profile.mode === 'astral' && profile.birth && (
            <p className="dot muted" style={{ margin: 0, fontSize: 14 }}>
              {profile.birth.date.split('-').reverse().join('.')}{profile.birth.time ? ` · ${profile.birth.time}` : ' · sem hora'}{profile.birth.place ? ` · ${profile.birth.place}` : ''}
            </p>
          )}
          <button className="btn glassy block" onClick={() => editProfile('book')}><Icon name="edit" size={16} /> editar favoritos</button>
          {profile.mode === 'astral' ? (
            <>
              <button className="btn glassy block" onClick={() => editProfile('mode')}>ajustar dados de nascimento</button>
              <button className="btn danger block" onClick={() => setConfirmBirth(true)}>desligar modo astral</button>
            </>
          ) : (
            <button className="btn glassy block" onClick={() => editProfile('mode')}>☾ ativar modo astral</button>
          )}
        </section>
      )}

      <section className="glass card stack" style={{ gap: 14 }}>
        <div className="row between">
          <b>leitura por IA</b>
          <span className="tag">{s.apiKey ? '✦ conectada' : 'desligada'}</span>
        </div>
        <p className="note" style={{ margin: 0 }}>
          com uma chave da API da Anthropic, o moody pede ao Claude o nome da fase, as palavras e a paleta. vão para a IA apenas títulos, notas, frases e as cores extraídas das fotos — nunca as fotos. sem chave, a leitura é feita localmente.
        </p>
        <label className="field">
          <span>chave da API</span>
          <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" value={s.apiKey} onChange={(e) => update({ apiKey: e.target.value.trim() })} />
        </label>
        <div className="field">
          <span>modelo</span>
          <div className="stack" style={{ gap: 6 }}>
            {MODELS.map((m) => (
              <button key={m.id} className={`hit${s.model === m.id ? ' on' : ''}`} onClick={() => update({ model: m.id })}>
                <span style={{ flex: 1 }}>
                  <b>{m.label}</b>
                  <small className="faint" style={{ display: 'block' }}>{m.hint}</small>
                </span>
                {s.model === m.id && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </div>
        <p className="note" style={{ margin: 0 }}>a chave fica salva só neste navegador. em produção, a chamada deve passar por um servidor próprio.</p>
        {s.model !== DEFAULT_MODEL && <button className="btn ghost sm" onClick={() => update({ model: DEFAULT_MODEL })}>voltar ao padrão</button>}
      </section>

      <section className="section glass card stack" style={{ gap: 14 }}>
        <div className="row between">
          <b>catálogos e capas</b>
          <span className="tag">{s.tmdbKey ? '✦ TMDB conectado' : 'TMDB desligado'}</span>
        </div>
        <p className="note" style={{ margin: 0 }}>
          filmes e séries: TMDB, em português, com pôster e direção. livros: Google Books, com Open Library de reserva. álbuns: MusicBrainz. a busca envia só o texto digitado; as capas escolhidas são baixadas e guardadas no aparelho.
        </p>
        <label className="field">
          <span>chave do TMDB (v3 ou token de leitura v4)</span>
          <input className="input" type="password" autoComplete="off" placeholder="gratuita em themoviedb.org → ajustes → API" value={s.tmdbKey} onChange={(e) => update({ tmdbKey: e.target.value.trim() })} />
        </label>
        <label className="field">
          <span>chave do Google Books (opcional)</span>
          <input className="input" type="password" autoComplete="off" placeholder="sem chave, vale a cota anônima do Google" value={s.googleKey} onChange={(e) => update({ googleKey: e.target.value.trim() })} />
        </label>
        <p className="note" style={{ margin: 0 }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </section>

      <section className="section glass card stack" style={{ gap: 10 }}>
        <b>privacidade</b>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
          <li>tudo fica no seu aparelho; não há conta nem servidor.</li>
          <li>fotos têm localização e metadados removidos antes de serem guardadas.</li>
          <li>lugares são registrados por nome e cidade, nunca por coordenada.</li>
          <li>recaps são privados; só saem daqui quando você compartilha.</li>
          <li>a leitura usa vocabulário estético e emocional, nunca rótulos de identidade.</li>
          <li>excluir um período apaga a leitura e os cards derivados dele.</li>
        </ul>
      </section>

      <section className="section glass card stack" style={{ gap: 10 }}>
        <b>seus dados</b>
        <p className="dot muted" style={{ margin: 0, fontSize: 14 }}>
          {String(periods.length).padStart(2, '0')} períodos · {String(entries.length).padStart(3, '0')} registros
        </p>
        <button className="btn glassy block" onClick={exportJson}><Icon name="download" size={18} /> exportar backup (json)</button>
        <button className="btn danger block" onClick={() => setConfirm(true)}><Icon name="trash" size={18} /> apagar tudo</button>
      </section>

      <p className="note" style={{ textAlign: 'center', marginTop: 28 }}>moody · v0.1 · feito com ✦</p>

      {confirmBirth && profile && (
        <Sheet title="desligar modo astral?" onClose={() => setConfirmBirth(false)}>
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>data, hora e cidade de nascimento serão apagadas deste aparelho. seus favoritos e registros continuam.</p>
            <button className="btn danger block" onClick={async () => { await saveProfile({ ...profile, mode: 'taste', birth: undefined }); setConfirmBirth(false); toast('modo astral desligado') }}>desligar e apagar</button>
          </div>
        </Sheet>
      )}

      {confirm && (
        <Sheet title="apagar tudo?" onClose={() => setConfirm(false)}>
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>perfil, períodos, registros, fotos e leituras serão apagados deste aparelho. não dá para desfazer.</p>
            <button className="btn danger block" onClick={async () => { await wipe(); setConfirm(false); toast('tudo apagado') }}>apagar definitivamente</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
