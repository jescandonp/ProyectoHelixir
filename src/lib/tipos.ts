export type EstadoPedido = 'borrador' | 'confirmado' | 'enviado' | 'entregado' | 'anulado'
export type EstadoPago = 'pendiente' | 'contraentrega' | 'pagado'
export type TipoEntrega = 'local' | 'nacional'
export type TipoCliente = 'detal' | 'mayorista'

export interface Producto {
  id: string
  nombre: string
  emoji: string | null
  precio: number
  activo: boolean
  orden: number
}

export interface ItemPedido {
  productoId: string | null
  descripcion: string
  cantidad: number
  precioUnitario: number
}

export interface Totales {
  subtotal: number
  totalKg: number
  total: number
}

export interface Direccion {
  id: string
  clienteId: string
  etiqueta: string | null
  linea: string
  barrio: string | null
  ciudad: string
  departamento: string | null
  indicaciones: string | null
  esPrincipal: boolean
}

export interface Cliente {
  id: string
  codigo: string
  nombre: string
  telefono: string | null
  cedula: string | null
  tipo: TipoCliente
  notas: string | null
  direcciones?: Direccion[]
}
