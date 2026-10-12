import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // no GitHub Pages o app fica em /mood/; localmente, na raiz
  base: process.env.BASE ?? '/',
  plugins: [react()],
  server: { host: true },
})
