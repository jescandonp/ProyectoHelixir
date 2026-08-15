// Esta prueba reproduce la consulta en vez de llamar a `listarPedidos`
// porque ese repositorio lleva `'use server'` y usa `next/headers`, que no
// existe corriendo Vitest en Node. Lo que se verifica es la garantía a
// nivel de base —el filtro que excluye los borradores—, que es donde vive
// el riesgo. Es el mismo patrón que las pruebas del consecutivo.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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

describe('el listado esconde los borradores', () => {
  it('un pedido sin consecutivo no aparece ni cuenta', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba borrador' }).select('id').single()

    try {
      // Un borrador huérfano, como el que deja un fallo a mitad de confirmar
      await supabase.from('pedidos').insert({ cliente_id: cliente!.id, total: 99999 })

      // Un pedido de verdad
      const { data: real } = await supabase
        .from('pedidos').insert({ cliente_id: cliente!.id, total: 11111 }).select('id').single()
      await supabase.rpc('asignar_consecutivo', { p_pedido_id: real!.id })

      const { data, count } = await supabase
        .from('pedidos')
        .select('consecutivo, total', { count: 'exact' })
        .eq('cliente_id', cliente!.id)
        .not('consecutivo', 'is', null)

      expect(count).toBe(1)
      expect(data![0].total).toBe(11111)
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
})
