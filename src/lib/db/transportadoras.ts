import { crearClienteServidor } from './cliente-supabase'

export interface Transportadora {
  id: string
  nombre: string
}

export async function listarTransportadorasActivas(): Promise<Transportadora[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('transportadoras')
    .select('id, nombre')
    .eq('activa', true)
    .order('orden')

  if (error) throw new Error(`No se pudo leer las transportadoras: ${error.message}`)
  return data ?? []
}
