'use server'

import { crearClienteServidor, obtenerUsuarioActual } from './cliente-supabase'
import { calcularTotales, calcularSubtotalItem } from '@/lib/pedidos/calculos'
import { validarParaConfirmar } from '@/lib/pedidos/validacion'
import { puedeTransicionar } from '@/lib/pedidos/estados'
import type {
  ItemPedido, EstadoPedido, EstadoPago, TipoEntrega,
} from '@/lib/tipos'

export interface DatosBorrador {
  clienteId: string | null
  direccionId: string | null
  items: ItemPedido[]
  tipoEntrega: TipoEntrega
  transportadora: string | null
  estadoPago: EstadoPago
  valorDomicilio: number
  descuento: number
  observaciones: string
}

export interface PedidoCompleto {
  id: string
  consecutivo: string | null
  fecha: string
  estado: EstadoPedido
  estadoPago: EstadoPago
  tipoEntrega: TipoEntrega
  transportadora: string | null
  fechaPago: string | null

  clienteCodigo: string
  clienteNombre: string
  clienteTelefono: string | null
  clienteCedula: string | null

  dirLinea: string | null
  dirBarrio: string | null
  dirCiudad: string | null
  dirDepartamento: string | null
  dirIndicaciones: string | null

  asesorCodigo: string | null
  valorDomicilio: number
  descuento: number
  subtotal: number
  total: number
  totalKg: number
  observaciones: string | null

  items: (ItemPedido & { subtotal: number })[]
}

export async function crearBorrador(): Promise<string> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ estado: 'borrador', cliente_id: null })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo crear el borrador: ${error.message}`)
  return data.id
}

export async function guardarBorrador(id: string, borrador: DatosBorrador): Promise<void> {
  const supabase = await crearClienteServidor()
  const totales = calcularTotales(borrador.items, borrador.valorDomicilio, borrador.descuento)

  const { error } = await supabase
    .from('pedidos')
    .update({
      cliente_id: borrador.clienteId,
      direccion_id: borrador.direccionId,
      tipo_entrega: borrador.tipoEntrega,
      transportadora: borrador.transportadora,
      estado_pago: borrador.estadoPago,
      valor_domicilio: borrador.valorDomicilio,
      descuento: borrador.descuento,
      observaciones: borrador.observaciones,
      subtotal: totales.subtotal,
      total: totales.total,
      total_kg: totales.totalKg,
    })
    .eq('id', id)
    .eq('estado', 'borrador')

  if (error) throw new Error(`No se pudo guardar el borrador: ${error.message}`)

  await supabase.from('pedido_items').delete().eq('pedido_id', id)

  if (borrador.items.length > 0) {
    const filas = borrador.items.map((item, indice) => ({
      pedido_id: id,
      producto_id: item.productoId,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: calcularSubtotalItem(item),
      orden: indice,
    }))
    const { error: errorItems } = await supabase.from('pedido_items').insert(filas)
    if (errorItems) throw new Error(`No se pudieron guardar los ítems: ${errorItems.message}`)
  }
}

export async function confirmarPedido(id: string): Promise<{ consecutivo: string }> {
  const supabase = await crearClienteServidor()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*), clientes(codigo, nombre, telefono, cedula), direcciones(*)')
    .eq('id', id)
    .single()

  if (error || !pedido) throw new Error('No se encontró el pedido')

  const items: ItemPedido[] = (pedido.pedido_items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => ({
      productoId: i.producto_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    }),
  )

  const problemas = validarParaConfirmar({
    clienteId: pedido.cliente_id,
    direccionId: pedido.direccion_id,
    items,
    tipoEntrega: pedido.tipo_entrega,
    transportadora: pedido.transportadora,
  })
  if (problemas.length > 0) throw new Error(problemas.join('. '))

  if (!puedeTransicionar(pedido.estado, 'confirmado')) {
    throw new Error(`Un pedido en estado "${pedido.estado}" no se puede confirmar`)
  }

  const usuario = await obtenerUsuarioActual()
  const totales = calcularTotales(items, pedido.valor_domicilio, pedido.descuento)

  // Se congela todo lo que va impreso: si mañana cambia la ficha del cliente,
  // este pedido sigue diciendo lo que decía el día que salió.
  const { error: errorUpdate } = await supabase
    .from('pedidos')
    .update({
      estado: 'confirmado',
      cliente_codigo: pedido.clientes.codigo,
      cliente_nombre: pedido.clientes.nombre,
      cliente_telefono: pedido.clientes.telefono,
      cliente_cedula: pedido.clientes.cedula,
      dir_linea: pedido.direcciones?.linea ?? null,
      dir_barrio: pedido.direcciones?.barrio ?? null,
      dir_ciudad: pedido.direcciones?.ciudad ?? null,
      dir_departamento: pedido.direcciones?.departamento ?? null,
      dir_indicaciones: pedido.direcciones?.indicaciones ?? null,
      asesor_id: usuario?.id ?? null,
      asesor_codigo: usuario?.codigoAsesor ?? null,
      subtotal: totales.subtotal,
      total: totales.total,
      total_kg: totales.totalKg,
      fecha: new Date().toISOString(),
    })
    .eq('id', id)

  if (errorUpdate) throw new Error(`No se pudo confirmar: ${errorUpdate.message}`)

  const { data: consecutivo, error: errorConsecutivo } = await supabase.rpc(
    'asignar_consecutivo', { p_pedido_id: id },
  )
  if (errorConsecutivo) throw new Error(`No se pudo asignar el consecutivo: ${errorConsecutivo.message}`)

  return { consecutivo: consecutivo as string }
}

export async function obtenerPedido(id: string): Promise<PedidoCompleto | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*)')
    .eq('id', id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    consecutivo: data.consecutivo,
    fecha: data.fecha,
    estado: data.estado,
    estadoPago: data.estado_pago,
    tipoEntrega: data.tipo_entrega,
    transportadora: data.transportadora,
    fechaPago: data.fecha_pago,
    clienteCodigo: data.cliente_codigo ?? '',
    clienteNombre: data.cliente_nombre ?? '',
    clienteTelefono: data.cliente_telefono,
    clienteCedula: data.cliente_cedula,
    dirLinea: data.dir_linea,
    dirBarrio: data.dir_barrio,
    dirCiudad: data.dir_ciudad,
    dirDepartamento: data.dir_departamento,
    dirIndicaciones: data.dir_indicaciones,
    asesorCodigo: data.asesor_codigo,
    valorDomicilio: data.valor_domicilio,
    descuento: data.descuento,
    subtotal: data.subtotal,
    total: data.total,
    totalKg: data.total_kg,
    observaciones: data.observaciones,
    items: (data.pedido_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.orden - b.orden)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => ({
        productoId: i.producto_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
  }
}

export async function anularPedido(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new Error('Anular exige un motivo')

  const supabase = await crearClienteServidor()
  const { data: pedido } = await supabase.from('pedidos').select('estado').eq('id', id).single()
  if (!pedido) throw new Error('No se encontró el pedido')

  if (!puedeTransicionar(pedido.estado, 'anulado')) {
    throw new Error(`Un pedido en estado "${pedido.estado}" no se puede anular`)
  }

  const usuario = await obtenerUsuarioActual()
  const { error } = await supabase
    .from('pedidos')
    .update({
      estado: 'anulado',
      anulado_motivo: motivo.trim(),
      anulado_por: usuario?.id ?? null,
      anulado_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo anular: ${error.message}`)
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
