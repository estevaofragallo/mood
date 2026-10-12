import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Icon } from './components/Icon'
import { Home } from './screens/Home'
import { PeriodScreen } from './screens/PeriodScreen'
import { ShareScreen } from './screens/ShareScreen'
import { Eras } from './screens/Eras'
import { Settings } from './screens/Settings'
import { AddEntrySheet } from './screens/AddEntrySheet'
import { NewPeriodSheet } from './screens/NewPeriodSheet'
import { Onboarding } from './screens/Onboarding'
import { inRange, today } from './lib/periods'
import type { Entry, PeriodKind } from './lib/types'

type Route = { name: 'home' } | { name: 'eras' } | { name: 'settings' } | { name: 'period'; id: string } | { name: 'share'; id: string }
type Overlay = { kind: 'add'; date?: string; prefill?: Parameters<typeof AddEntrySheet>[0]['prefill'] } | { kind: 'edit'; entry: Entry } | { kind: 'period'; initial?: PeriodKind } | null

export function App() {
  const { ready, periods, profile } = useStore()
  const [editProfile, setEditProfile] = useState<null | 'book' | 'mode'>(null)
  // fica no onboarding até a pessoa sair pela tela final (o perfil é salvo um passo antes)
  const [onboarding, setOnboarding] = useState(!profile)
  useEffect(() => {
    if (!profile) setOnboarding(true)
  }, [profile])
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [history, setHistory] = useState<Route[]>([])
  const [overlay, setOverlay] = useState<Overlay>(null)

  const go = (r: Route) => {
    setHistory((h) => [...h, route])
    setRoute(r)
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    setRoute(history[history.length - 1] ?? { name: 'home' })
    setHistory((h) => h.slice(0, -1))
  }
  const tab = (r: Route) => {
    setHistory([])
    setRoute(r)
    window.scrollTo({ top: 0 })
  }

  // período removido: volta para o início
  const period = route.name === 'period' || route.name === 'share' ? periods.find((p) => p.id === route.id) : undefined
  useEffect(() => {
    if ((route.name === 'period' || route.name === 'share') && ready && !period) tab({ name: 'home' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, ready])

  // FAB: registra com data de hoje, ou dentro do período aberto na tela
  const quickAdd = () => {
    const date = period && !inRange(today(), period) ? period.end : today()
    setOverlay({ kind: 'add', date })
  }

  if (!ready) return null

  const atmosphere = (
    <div className="atmosphere" aria-hidden>
      <div className="orb a" />
      <div className="orb b" />
      <div className="orb c" />
      <div className="scan" />
      <div className="grain" />
    </div>
  )

  // primeiro acesso, ou edição do perfil a partir de ajustes
  if (onboarding || !profile || editProfile) {
    return (
      <>
        {atmosphere}
        <main className="app" style={{ paddingBottom: 48 }}>
          <Onboarding
            initial={editProfile ? profile : null}
            startAt={editProfile ?? undefined}
            onDone={() => {
              setOnboarding(false)
              setEditProfile(null)
              tab({ name: 'home' })
            }}
            onCancel={() => setEditProfile(null)}
          />
        </main>
      </>
    )
  }

  return (
    <>
      {atmosphere}

      <main className="app" key={route.name + ('id' in route ? route.id : '')}>
        {route.name === 'home' && (
          <Home openPeriod={(id) => go({ name: 'period', id })} newPeriod={(initial) => setOverlay({ kind: 'period', initial })} editEntry={(entry) => setOverlay({ kind: 'edit', entry })}
            registerPick={(p) => setOverlay({ kind: 'add', prefill: { type: p.type, title: p.title, subtitle: p.creator, year: p.year, coverUrl: p.coverUrl } })}
          />
        )}
        {route.name === 'eras' && <Eras openPeriod={(id) => go({ name: 'period', id })} />}
        {route.name === 'settings' && <Settings editProfile={(at) => setEditProfile(at)} />}
        {route.name === 'period' && period && (
          <PeriodScreen
            period={period}
            back={back}
            share={() => go({ name: 'share', id: period.id })}
            addEntry={(date) => setOverlay({ kind: 'add', date })}
            editEntry={(entry) => setOverlay({ kind: 'edit', entry })}
          />
        )}
        {route.name === 'share' && period && <ShareScreen period={period} back={back} />}
      </main>

      {route.name !== 'share' && (
        <nav className="dock" aria-label="navegação">
          <div className="tabs">
            <button className={route.name === 'home' || route.name === 'period' ? 'on' : ''} onClick={() => tab({ name: 'home' })}>
              <Icon name="home" size={20} /> agora
            </button>
            <button className={route.name === 'eras' ? 'on' : ''} onClick={() => tab({ name: 'eras' })}>
              <Icon name="eras" size={20} /> eras
            </button>
            <button className={route.name === 'settings' ? 'on' : ''} onClick={() => tab({ name: 'settings' })}>
              <Icon name="settings" size={20} /> ajustes
            </button>
          </div>
          <button className="fab" onClick={quickAdd} aria-label="registrar">
            <Icon name="plus" size={28} strokeWidth={2} />
          </button>
        </nav>
      )}

      {overlay?.kind === 'add' && <AddEntrySheet defaultDate={overlay.date} prefill={overlay.prefill} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'edit' && <AddEntrySheet editing={overlay.entry} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'period' && (
        <NewPeriodSheet
          initialKind={overlay.initial}
          onClose={() => setOverlay(null)}
          onCreated={(id) => {
            setOverlay(null)
            go({ name: 'period', id })
          }}
        />
      )}
    </>
  )
}
