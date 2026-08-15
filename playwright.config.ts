import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

// Las credenciales del usuario de prueba viven en `.env.local`, igual que
// las de la base. Se cargan aquí para no tener que exportarlas a mano.
config({ path: '.env.local' })

// Un worktree no puede levantar su `next dev` en el 3000 si el principal ya
// lo tiene ocupado, y sin esto Playwright probaría el servidor del otro
// worktree —o sea, código que no es el de la rama— y fallaría sin que se
// entienda por qué. `E2E_URL_BASE` deja apuntarlo al puerto que toque.
const URL_BASE = process.env.E2E_URL_BASE ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: { baseURL: URL_BASE },
  webServer: {
    command: 'npm run dev',
    url: `${URL_BASE}/ingresar`,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
