import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import { ToastProvider } from './components/Toast'
import { App } from './App'
import './styles/global.css'
import { applyTheme, loadThemeId } from './lib/theme'

applyTheme(loadThemeId())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
