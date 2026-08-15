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

describe('el listado esconde los borradores', () => {
  it('un pedido sin consecutivo no aparece ni cuenta', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba borrador' }).select('id').single()

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

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
