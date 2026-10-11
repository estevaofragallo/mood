import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null)
  const show = useCallback((text: string) => {
    const key = Date.now()
    setMsg({ text, key })
    setTimeout(() => setMsg((m) => (m?.key === key ? null : m)), 2800)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status" key={msg.key}>
          {msg.text}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
