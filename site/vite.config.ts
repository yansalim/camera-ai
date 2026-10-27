import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // Em desenvolvimento o Vite encaminha a API para o pintor.
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        termos: resolve(import.meta.dirname, 'termos.html'),
      },
    },
  },
})
