// Esta prueba no llama a `listarPedidos` porque ese repositorio lleva
// `'use server'` y usa `next/headers`, que no existe corriendo Vitest en
// Node. En su lugar arma la consulta a mano y le aplica el mismo
// `filtrarPedidosReales` que usa `pedidos-consultas.ts`, así que si alguien
// revierte el filtro en ese archivo compartido, esta prueba falla: ambos
// leen la misma función, no una copia.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { filtrarPedidosReales } from './filtros-pedidos'

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

  // Este es el defecto real que se corrigió: 128 filas en la base local
  // estaban en `estado = 'borrador'` pero ya tenían consecutivo asignado
  // (`confirmarPedido` cambia el estado y solo después pide el consecutivo,
  // así que un fallo entre esos dos pasos —o una asignación manual fuera de
  // ese flujo— deja un pedido así). Filtrar solo por "tiene consecutivo" no
  // basta para esconderlas; hace falta el `.neq('estado', 'borrador')`
  // explícito. Esta prueba usa `filtrarPedidosReales`, la misma función que
  // `pedidos-consultas.ts`, así que si alguien revierte el filtro ahí —que
  // es donde vive de verdad, no en una copia aquí— esta prueba falla.
  it('un borrador con consecutivo ya asignado no aparece ni cuenta', async () => {
    const { data: cliente } = await supabase
      .from('clientes').insert({ nombre: 'Prueba borrador con consecutivo' }).select('id').single()

    try {
      // Se inserta sin `estado`: la columna por defecto es 'borrador', que es
      // justo el caso que hay que reproducir.
      const { data: borrador } = await supabase
        .from('pedidos').insert({ cliente_id: cliente!.id, total: 22222 }).select('id').single()
      await supabase.rpc('asignar_consecutivo', { p_pedido_id: borrador!.id })

      const { data, count } = await filtrarPedidosReales(
        supabase
          .from('pedidos')
          .select('consecutivo, total', { count: 'exact' })
          .eq('cliente_id', cliente!.id),
      )

      expect(count).toBe(0)
      expect(data).toEqual([])
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
})
