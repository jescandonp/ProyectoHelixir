// Módulo de servidor: importa `next/headers`. Para el navegador está
// `cliente-navegador.ts`.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function crearClienteServidor() {
  const almacen = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (nuevas) => {
        try {
          nuevas.forEach(({ name, value, options }) => almacen.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el proxy refresca la sesión.
        }
      },
    },
  })
}

export async function obtenerUsuarioActual() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, codigo_asesor')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return { id: data.id, nombre: data.nombre, codigoAsesor: data.codigo_asesor }
}
