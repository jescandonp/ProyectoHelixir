// Ver la nota en el plan: no se llama a `listarTransportadorasActivas` porque
// usa `next/headers`, que no existe corriendo Vitest en Node. Se prueba la
// misma consulta armada a mano, igual que ya hace `pedidos-consultas.integracion.test.ts`.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

describe('la tabla transportadoras', () => {
  it('la consulta de activas, en orden, trae solo la semilla del negocio', async () => {
    const { data: inactiva, error } = await supabase
      .from('transportadoras')
      .insert({ nombre: 'Transportadora De Prueba Inactiva', activa: false, orden: 99 })
      .select('id').single()
    if (error) throw new Error(`No se pudo sembrar la transportadora de prueba: ${error.message}`)

    try {
      const { data: activas, error: errorConsulta } = await supabase
        .from('transportadoras')
        .select('id, nombre')
        .eq('activa', true)
        .order('orden')
      if (errorConsulta) throw new Error(`Falló la consulta: ${errorConsulta.message}`)

      expect(activas!.map((t) => t.nombre)).toEqual([
        'Interrapidísimo', 'Servientrega', 'TCC', 'Coordinadora',
      ])
      expect(activas!.find((t) => t.id === inactiva!.id)).toBeUndefined()
    } finally {
      await supabase.from('transportadoras').delete().eq('id', inactiva!.id)
    }
  })
})
