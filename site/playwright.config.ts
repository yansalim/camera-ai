import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const acervo = path.resolve(import.meta.dirname, 'e2e/.acervo')

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/preparar.ts',
  timeout: 60_000,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm --prefix ../servidor run dev',
      url: 'http://localhost:3000/api/saude',
      // Limite de IP alto: todos os testes saem do mesmo 127.0.0.1.
      env: { PROVEDOR: 'falso', EVENTO_ATIVO: 'true', ACERVO_DIR: acervo, ESTILOS_DIR: '../estilos', PORTA: '3000', LIMITE_IP: '10000' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
