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

describe('asignar_consecutivo', () => {
  it('no repite números aunque se pidan al mismo tiempo', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba concurrencia' }).select('id').single()

    const ids = await Promise.all(
      Array.from({ length: 10 }, () => crearPedidoDePrueba(cliente!.id)),
    )

    const resultados = await Promise.all(
      ids.map((id) => supabase.rpc('asignar_consecutivo', { p_pedido_id: id })),
    )

    const consecutivos = resultados.map((r) => r.data as string)
    expect(new Set(consecutivos).size).toBe(10)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)

  it('es idempotente: pedirlo dos veces devuelve el mismo número', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba idempotencia' }).select('id').single()
    const id = await crearPedidoDePrueba(cliente!.id)

    const primera = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })
    const segunda = await supabase.rpc('asignar_consecutivo', { p_pedido_id: id })

    expect(segunda.data).toBe(primera.data)

    await supabase.from('clientes').delete().eq('id', cliente!.id)
  }, 30000)
})
