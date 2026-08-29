'use server'

import { crearClienteServidor } from './cliente-supabase'
import { filtrarPedidosReales } from './filtros-pedidos'
import { POR_PAGINA } from './paginacion'
import { rangoDelDia, type Rango } from '@/lib/periodo'
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

/** Encadena los filtros comunes a `listarPedidos` y `listarPedidosParaExportar`.
 *  `T` no lleva restricción de tipo por la misma razón documentada en
 *  `filtrarPedidosReales` (filtros-pedidos.ts): las firmas sobrecargadas del
 *  `PostgrestFilterBuilder` real disparan "Type instantiation is excessively
 *  deep" si TypeScript intenta comprobarlas contra una restricción genérica. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros<T>(consulta: T, filtros: Omit<FiltrosPedidos, 'pagina'>): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let c = consulta as any
  if (filtros.rango) c = c.gte('fecha', filtros.rango.desde).lt('fecha', filtros.rango.hasta)
  if (filtros.estado) c = c.eq('estado', filtros.estado)
  if (filtros.estadoPago) c = c.eq('estado_pago', filtros.estadoPago)
  if (filtros.soloPorCobrar) c = c.neq('estado_pago', 'pagado').neq('estado', 'anulado')
  if (filtros.clienteId) c = c.eq('cliente_id', filtros.clienteId)
  if (filtros.asesorId) c = c.eq('asesor_id', filtros.asesorId)
  return c as T
}

export async function listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos> {
  const supabase = await crearClienteServidor()
  const pagina = filtros.pagina ?? 0
  const primera = pagina * POR_PAGINA

  const consulta = aplicarFiltros(
    filtrarPedidosReales(supabase.from('pedidos').select(COLUMNAS, { count: 'exact' })),
    filtros,
  )
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .range(primera, primera + POR_PAGINA - 1)

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudo leer la lista de pedidos: ${error.message}`)

  return { filas: (data ?? []).map(mapearFila), total: count ?? 0 }
}

/** Igual que `listarPedidos`, pero sin `.range()`: trae todas las filas que
 *  cumplen el filtro. La usa la exportación a Excel/PDF, donde "el resultado
 *  filtrado" tiene que ser todo, no la página de 50 que se ve en pantalla. */
export async function listarPedidosParaExportar(
  filtros: Omit<FiltrosPedidos, 'pagina'>,
): Promise<FilaPedido[]> {
  const supabase = await crearClienteServidor()

  const consulta = aplicarFiltros(
    filtrarPedidosReales(supabase.from('pedidos').select(COLUMNAS)),
    filtros,
  )
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })

  const { data, error } = await consulta
  if (error) throw new Error(`No se pudo leer los pedidos para exportar: ${error.message}`)
  return (data ?? []).map(mapearFila)
}

/** PostgREST no suma sin una función SQL, y meter la lógica del negocio en
 *  una migración la vuelve difícil de cambiar. Se trae una sola columna del
 *  conjunto pendiente —que el negocio trabaja para mantener pequeño— y se
 *  suma aquí. Si algún día crece, esto se cambia por un RPC. */
export async function resumenPorCobrar(): Promise<{ total: number; pedidos: number }> {
  const supabase = await crearClienteServidor()
  const { data, error } = await filtrarPedidosReales(
    supabase.from('pedidos').select('total'),
  )
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
  const { data, error } = await filtrarPedidosReales(
    supabase.from('pedidos').select(COLUMNAS).eq('cliente_id', clienteId),
  )
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
  const { data: totales, error: errorTotales } = await filtrarPedidosReales(
    supabase.from('pedidos').select('total').eq('cliente_id', clienteId),
  ).neq('estado', 'anulado')

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
  // `rangoDelDia()` usa el día civil en Bogotá, no la zona del servidor.
  // Con `new Date().setHours(0,0,0,0)` a mano, en Vercel (UTC) la
  // medianoche caía a las 7 p.m. de ayer en Bogotá: un cliente que pidió
  // anoche disparaba una alerta falsa de posible duplicado hoy.
  const { desde } = rangoDelDia()

  // Un borrador —el mismo formulario que se está llenando, u otro
  // abandonado— no es un pedido puesto y no debe disparar el aviso de
  // posible duplicado; de ahí `filtrarPedidosReales`.
  const { data } = await filtrarPedidosReales(
    supabase.from('pedidos').select('consecutivo, total').eq('cliente_id', clienteId),
  )
    .neq('estado', 'anulado')
    .gte('fecha', desde)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({ consecutivo: p.consecutivo, total: p.total }))
}
