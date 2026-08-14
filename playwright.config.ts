import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

// Las credenciales del usuario de prueba viven en `.env.local`, igual que
// las de la base. Se cargan aquí para no tener que exportarlas a mano.
config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/ingresar',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
