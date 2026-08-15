import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function crearPedidoDePrueba(clienteId: string): Promise<string> {
  const { data, error } = await supabase
    .from('pedidos').insert({ cliente_id: clienteId }).select('id').single()
  if (error) throw error
  return data.id
}

// Borra primero los pedidos del cliente y luego el cliente: `pedidos.cliente_id`
// no lleva `on delete cascade` (a propósito, para no perder historial de ventas
// si algún día se borra un cliente por error), así que borrar el cliente
// primero deja los pedidos huérfanos en la base. Se comprueba el error de
// cada borrado porque una limpieza que falla en silencio no limpia nada y
// nadie se entera.
async function limpiarClienteDePrueba(clienteId: string): Promise<void> {
  const { error: errorPedidos } = await supabase.from('pedidos').delete().eq('cliente_id', clienteId)
  if (errorPedidos) throw new Error(`No se pudieron limpiar los pedidos de prueba: ${errorPedidos.message}`)

  const { error: errorCliente } = await supabase.from('clientes').delete().eq('id', clienteId)
  if (errorCliente) throw new Error(`No se pudo limpiar el cliente de prueba: ${errorCliente.message}`)
}

describe('asignar_consecutivo', () => {
  it('no repite números aunque se pidan al mismo tiempo', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba concurrencia' }).select('id').single()

    try {
      const ids = await Promise.all(
        Array.from({ length: 10 }, () => crearPedidoDePrueba(cliente!.id)),
      )

      const resultados = await Promise.all(
        ids.map((id) => supabase.rpc('asignar_consecutivo', { p_pedido_id: id })),
      )

      const consecutivos = resultados.map((r) => r.data as string)
      expect(new Set(consecutivos).size).toBe(10)
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)

  it('es idempotente: pedirlo dos veces devuelve el mismo número', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba idempotencia' }).select('id').single()

    try {
      const id = await crearPedidoDePrueba(cliente!.id)

      const primera = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })
      const segunda = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })

      expect(segunda.data).toBe(primera.data)
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
})
