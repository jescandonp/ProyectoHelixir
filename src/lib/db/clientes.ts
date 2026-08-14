'use server'

import { crearClienteServidor } from './cliente-supabase'
import type { Cliente, Direccion, TipoCliente } from '@/lib/tipos'

const CAMPOS = `
  id, codigo, nombre, telefono, cedula, tipo, notas,
  direcciones ( id, cliente_id, etiqueta, linea, barrio, ciudad,
                departamento, indicaciones, es_principal )
`

type FilaDireccion = {
  id: string; cliente_id: string; etiqueta: string | null; linea: string
  barrio: string | null; ciudad: string; departamento: string | null
  indicaciones: string | null; es_principal: boolean
}

function mapearDireccion(f: FilaDireccion): Direccion {
  return {
    id: f.id, clienteId: f.cliente_id, etiqueta: f.etiqueta, linea: f.linea,
    barrio: f.barrio, ciudad: f.ciudad, departamento: f.departamento,
    indicaciones: f.indicaciones, esPrincipal: f.es_principal,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearCliente(f: any): Cliente {
  return {
    id: f.id, codigo: f.codigo, nombre: f.nombre, telefono: f.telefono,
    cedula: f.cedula, tipo: f.tipo, notas: f.notas,
    direcciones: (f.direcciones ?? []).map(mapearDireccion),
  }
}

export async function buscarClientes(texto: string): Promise<Cliente[]> {
  const termino = texto.trim()
  if (termino.length < 2) return []

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('clientes')
    .select(CAMPOS)
    .or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,codigo.ilike.%${termino}%`)
    .limit(8)

  if (error) throw new Error(`No se pudo buscar el cliente: ${error.message}`)
  return (data ?? []).map(mapearCliente)
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('clientes').select(CAMPOS).eq('id', id).single()
  return data ? mapearCliente(data) : null
}

export async function crearCliente(
  datos: { nombre: string; telefono: string; cedula: string; tipo: TipoCliente },
  direccion: {
    linea: string; barrio: string; ciudad: string
    departamento: string; indicaciones: string
  },
): Promise<Cliente> {
  const supabase = await crearClienteServidor()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      tipo: datos.tipo,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo crear el cliente: ${error.message}`)

  const { error: errorDir } = await supabase.from('direcciones').insert({
    cliente_id: cliente.id,
    linea: direccion.linea.trim(),
    barrio: direccion.barrio.trim() || null,
    ciudad: direccion.ciudad.trim(),
    departamento: direccion.departamento.trim() || null,
    indicaciones: direccion.indicaciones.trim() || null,
    es_principal: true,
  })

  if (errorDir) throw new Error(`No se pudo guardar la dirección: ${errorDir.message}`)

  const completo = await obtenerCliente(cliente.id)
  if (!completo) throw new Error('El cliente se creó pero no se pudo leer')
  return completo
}
