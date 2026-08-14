import { crearClienteServidor } from './cliente-supabase'
import type { Producto } from '@/lib/tipos'

export async function listarProductosActivos(): Promise<Producto[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, emoji, precio, activo, orden')
    .eq('activo', true)
    .order('orden')

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)
  return data ?? []
}
