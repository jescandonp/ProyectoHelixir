'use server'

import { crearClienteServidor } from './cliente-supabase'
import type { Cliente, Direccion, TipoCliente } from '@/lib/tipos'
import { CLIENTES_POR_PAGINA } from './paginacion'

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

export interface DatosDireccion {
  etiqueta: string
  linea: string
  barrio: string
  ciudad: string
  departamento: string
  indicaciones: string
}

/** El buscador del pedido no sirve aquí: devuelve máximo 8 y exige dos
 *  letras, porque está hecho para autocompletar mientras se digita. */
export async function listarClientes(
  texto: string,
  pagina = 0,
): Promise<{ filas: Cliente[]; total: number }> {
  const supabase = await crearClienteServidor()
  const termino = texto.trim()
  const primera = pagina * CLIENTES_POR_PAGINA

  let consulta = supabase
    .from('clientes')
    .select(CAMPOS, { count: 'exact' })
    .order('nombre')
    .range(primera, primera + CLIENTES_POR_PAGINA - 1)

  if (termino) {
    consulta = consulta.or(
      `nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,codigo.ilike.%${termino}%`,
    )
  }

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de clientes: ${error.message}`)

  return { filas: (data ?? []).map(mapearCliente), total: count ?? 0 }
}

/** Cambia la ficha, nunca los pedidos: esos guardan su copia congelada. */
export async function actualizarCliente(
  id: string,
  datos: { nombre: string; telefono: string; cedula: string; tipo: TipoCliente; notas: string },
): Promise<void> {
  const supabase = await crearClienteServidor()
  if (!datos.nombre.trim()) throw new Error('El cliente necesita un nombre')

  const { error } = await supabase
    .from('clientes')
    .update({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      cedula: datos.cedula.trim() || null,
      tipo: datos.tipo,
      notas: datos.notas.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo guardar el cliente: ${error.message}`)
}

function filaDireccion(dir: DatosDireccion) {
  if (!dir.linea.trim()) throw new Error('La dirección necesita una línea')
  if (!dir.ciudad.trim()) throw new Error('La dirección necesita una ciudad')
  return {
    etiqueta: dir.etiqueta.trim() || null,
    linea: dir.linea.trim(),
    barrio: dir.barrio.trim() || null,
    ciudad: dir.ciudad.trim(),
    departamento: dir.departamento.trim() || null,
    indicaciones: dir.indicaciones.trim() || null,
  }
}

export async function agregarDireccion(
  clienteId: string,
  dir: DatosDireccion,
): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('direcciones')
    .insert({ cliente_id: clienteId, ...filaDireccion(dir), es_principal: false })
  if (error) throw new Error(`No se pudo agregar la dirección: ${error.message}`)
}

export async function actualizarDireccion(id: string, dir: DatosDireccion): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('direcciones').update(filaDireccion(dir)).eq('id', id)
  if (error) throw new Error(`No se pudo guardar la dirección: ${error.message}`)
}

export async function marcarDireccionPrincipal(
  clienteId: string,
  direccionId: string,
): Promise<void> {
  const supabase = await crearClienteServidor()

  const { error: errorLimpiar } = await supabase
    .from('direcciones').update({ es_principal: false }).eq('cliente_id', clienteId)
  if (errorLimpiar) throw new Error(`No se pudo cambiar la principal: ${errorLimpiar.message}`)

  const { error } = await supabase
    .from('direcciones').update({ es_principal: true }).eq('id', direccionId)
  if (error) throw new Error(`No se pudo cambiar la principal: ${error.message}`)
}
