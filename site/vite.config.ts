import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const pagina = (nome: string) => resolve(import.meta.dirname, `${nome}.html`)

export default defineConfig(({ mode }) => ({
  server: {
    // Em desenvolvimento o Vite encaminha a API para o pintor.
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      // A vitrine só entra no build de inspeção (--mode vitrine), nunca em site/dist.
      input: { index: pagina('index'), termos: pagina('termos'), ...(mode === 'vitrine' ? { vitrine: pagina('vitrine') } : {}) },
    },
  },
}))
