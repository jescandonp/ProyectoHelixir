// Verifica una garantía del modelo de datos —que las columnas congeladas
// del pedido no dependan de la ficha del cliente—, no una función. Por eso
// escribe contra la base directamente y no llama a `actualizarCliente`,
// que además lleva `'use server'` y no corre en Node.
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

describe('editar un cliente', () => {
  it('no reescribe los pedidos ya confirmados', async () => {
    const { data: cliente } = await supabase
      .from('clientes')
      .insert({ nombre: 'Nombre Viejo', telefono: '3000000000' })
      .select('id, codigo').single()

    try {
      // Un pedido confirmado guarda su propia copia congelada
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: cliente!.id,
          estado: 'confirmado',
          cliente_nombre: 'Nombre Viejo',
          cliente_codigo: cliente!.codigo,
          cliente_telefono: '3000000000',
          dir_ciudad: 'Medellín',
          total: 50000,
        })
        .select('id').single()
      await supabase.rpc('asignar_consecutivo', { p_pedido_id: pedido!.id })

      // Se corrige la ficha del cliente
      await supabase
        .from('clientes')
        .update({ nombre: 'Nombre Corregido', telefono: '3111111111' })
        .eq('id', cliente!.id)

      const { data: despues } = await supabase
        .from('pedidos')
        .select('cliente_nombre, cliente_telefono')
        .eq('id', pedido!.id).single()

      expect(despues!.cliente_nombre).toBe('Nombre Viejo')
      expect(despues!.cliente_telefono).toBe('3000000000')
    } finally {
      await limpiarClienteDePrueba(cliente!.id)
    }
  }, 30000)
})
