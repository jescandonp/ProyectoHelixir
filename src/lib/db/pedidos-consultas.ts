'use server'

import { crearClienteServidor } from './cliente-supabase'
import { POR_PAGINA } from './paginacion'
import type { Rango } from '@/lib/periodo'
import type { EstadoPedido, EstadoPago } from '@/lib/tipos'

const COLUMNAS =
  'id, consecutivo, fecha, cliente_nombre, cliente_codigo, dir_ciudad, total_kg, total, estado, estado_pago'

export interface FilaPedido {
  id: string
  consecutivo: string
  fecha: string
  clienteNombre: string
  clienteCodigo: string
  dirCiudad: string | null
  totalKg: number
  total: number
  estado: EstadoPedido
  estadoPago: EstadoPago
}

export interface FiltrosPedidos {
  rango?: Rango
  estado?: EstadoPedido
  estadoPago?: EstadoPago
  soloPorCobrar?: boolean
  clienteId?: string
  asesorId?: string
  pagina?: number
}

export interface PaginaPedidos {
  filas: FilaPedido[]
  total: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearFila(f: any): FilaPedido {
  return {
    id: f.id,
    consecutivo: f.consecutivo,
    fecha: f.fecha,
    clienteNombre: f.cliente_nombre ?? '',
    clienteCodigo: f.cliente_codigo ?? '',
    dirCiudad: f.dir_ciudad,
    totalKg: f.total_kg,
    total: f.total,
    estado: f.estado,
    estadoPago: f.estado_pago,
  }
}

export async function listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos> {
  const supabase = await crearClienteServidor()
  const pagina = filtros.pagina ?? 0
  const primera = pagina * POR_PAGINA

  let consulta = supabase
    .from('pedidos')
    .select(COLUMNAS, { count: 'exact' })
    // Un borrador huérfano de un fallo a mitad de confirmar no ensucia
    // la lista ni los totales.
    .not('consecutivo', 'is', null)
    // Dos pedidos pueden compartir el mismo instante en `fecha`; sin un
    // desempate por `id` el orden entre páginas no queda determinado y una
    // fila puede repetirse o desaparecer al paginar.
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .range(primera, primera + POR_PAGINA - 1)

  if (filtros.rango) {
    consulta = consulta.gte('fecha', filtros.rango.desde).lt('fecha', filtros.rango.hasta)
  }
  if (filtros.estado) consulta = consulta.eq('estado', filtros.estado)
  if (filtros.estadoPago) consulta = consulta.eq('estado_pago', filtros.estadoPago)
  if (filtros.soloPorCobrar) {
    consulta = consulta.neq('estado_pago', 'pagado').neq('estado', 'anulado')
  }
  if (filtros.clienteId) consulta = consulta.eq('cliente_id', filtros.clienteId)
  if (filtros.asesorId) consulta = consulta.eq('asesor_id', filtros.asesorId)

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de pedidos: ${error.message}`)

  return { filas: (data ?? []).map(mapearFila), total: count ?? 0 }
}

/** PostgREST no suma sin una función SQL, y meter la lógica del negocio en
 *  una migración la vuelve difícil de cambiar. Se trae una sola columna del
 *  conjunto pendiente —que el negocio trabaja para mantener pequeño— y se
 *  suma aquí. Si algún día crece, esto se cambia por un RPC. */
export async function resumenPorCobrar(): Promise<{ total: number; pedidos: number }> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .select('total')
    .not('consecutivo', 'is', null)
    .neq('estado_pago', 'pagado')
    .neq('estado', 'anulado')

  if (error) throw new Error(`No se pudo calcular lo pendiente por cobrar: ${error.message}`)

  const filas = data ?? []
  return {
    total: filas.reduce((suma, f) => suma + f.total, 0),
    pedidos: filas.length,
  }
}

export async function historialDelCliente(
  clienteId: string,
): Promise<{ filas: FilaPedido[]; totalComprado: number }> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS)
    .eq('cliente_id', clienteId)
    .not('consecutivo', 'is', null)
    .neq('estado', 'anulado')
    // Mismo desempate que en listarPedidos: sin el `id` como segundo
    // criterio, pedidos con la misma `fecha` quedarían en un orden
    // indeterminado entre lecturas.
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .limit(100)

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`)

  // El "total comprado" es un dato de vida del cliente y no puede depender
  // de la lista visible (limitada a 100). Si el cliente tiene más pedidos
  // que ese límite, sumar solo las filas traídas subestimaría el total. Por
  // eso se hace una segunda consulta, igual que en resumenPorCobrar, que
  // trae solo la columna `total` sin límite y sin ordenar (el orden no
  // afecta la suma).
  const { data: totales, error: errorTotales } = await supabase
    .from('pedidos')
    .select('total')
    .eq('cliente_id', clienteId)
    .not('consecutivo', 'is', null)
    .neq('estado', 'anulado')

  if (errorTotales) {
    throw new Error(`No se pudo calcular el total comprado: ${errorTotales.message}`)
  }

  const filas = (data ?? []).map(mapearFila)
  return {
    filas,
    totalComprado: (totales ?? []).reduce((suma, f) => suma + f.total, 0),
  }
}

export async function listarPedidosDeHoyDelCliente(
  clienteId: string,
): Promise<{ consecutivo: string; total: number }[]> {
  const supabase = await crearClienteServidor()
  const inicioDelDia = new Date()
  inicioDelDia.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('pedidos')
    .select('consecutivo, total')
    .eq('cliente_id', clienteId)
    .neq('estado', 'anulado')
    .not('consecutivo', 'is', null)
    .gte('fecha', inicioDelDia.toISOString())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({ consecutivo: p.consecutivo, total: p.total }))
}
