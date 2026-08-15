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

describe('marcar pagado', () => {
  it('cobrar dos veces conserva la fecha del primer cobro', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba cobro' }).select('id').single()
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

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
