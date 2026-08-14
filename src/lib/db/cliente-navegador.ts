import { createBrowserClient } from '@supabase/ssr'

// Vive aparte de `cliente-supabase.ts` a propósito: aquel importa
// `next/headers`, que no existe en el navegador. Si ambos compartieran
// archivo, cualquier componente cliente arrastraría esa dependencia y
// el build falla.
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
