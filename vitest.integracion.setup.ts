import { config } from 'dotenv'

// Las credenciales viven en `.env.local` (igual que para `next dev`), no en
// `.env`, que es lo único que carga `dotenv/config` por su cuenta.
config({ path: '.env.local' })
