// Reproduce el `update` de `marcarPagado` en vez de llamarlo: ese
// repositorio lleva `'use server'` y usa `next/headers`, ausente en Node.
// Lo que importa aquí es que la guarda `.neq('estado_pago','pagado')`
// impida reescribir la fecha, y eso se comprueba contra la base real.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function pedidoConfirmado(clienteId: string): Promise<string> {
  const { data } = await supabase
    .from('pedidos')
    .insert({ cliente_id: clienteId, estado: 'confirmado', total: 50000 })
    .select('id').single()
  await supabase.rpc('asignar_consecutivo', { p_pedido_id: data!.id })
  return data!.id
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

describe('marcar pagado', () => {
  it('cobrar dos veces conserva la fecha del primer cobro', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba cobro' }).select('id').single()

    try {
      const id = await pedidoConfirmado(cliente!.id)

      // Primer cobro
      await supabase
        .from('pedidos')
        .update({ estado_pago: 'pagado', fecha_pago: new Date().toISOString() })
        .eq('id', id)
        .neq('estado_pago', 'pagado')

      const { data: primera } = await supabase
        .from('pedidos').select('fecha_pago').eq('id', id).single()

      await new Promise((r) => setTimeout(r, 50))

      // Segundo intento: la guarda `neq` impide que reescriba
      await supabase
        .from('pedidos')
        .update({ estado_pago: 'pagado', fecha_pago: new Date().toISOString() })
        .eq('id', id)
        .neq('estado_pago', 'pagado')

      const { data: segunda } = await supabase
        .from('pedidos').select('fecha_pago').eq('id', id).single()

      expect(segunda!.fecha_pago).toBe(primera!.fecha_pago)
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
})
