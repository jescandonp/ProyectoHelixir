import { describe, expect, it } from 'vitest'
import { renderReciboPdf } from './ReciboPdf'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias por su compra',
}

const pedido: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'nacional',
  transportadora: 'Servientrega', fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789', clienteCorreo: 'juanito@correo.com',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: 'Pago contraentrega',
  items: [
    { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
    { productoId: 'b', descripcion: 'Maracuyá', cantidad: 4, precioUnitario: 25000, subtotal: 100000 },
  ],
}

describe('renderReciboPdf', () => {
  it('renderiza un PDF no vacío, pendiente de pago', async () => {
    const buffer = await renderReciboPdf(pedido, ajustes)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza un PDF no vacío, ya pagado', async () => {
    const buffer = await renderReciboPdf(
      { ...pedido, estadoPago: 'pagado', fechaPago: '2026-08-11T22:00:00.000Z' }, ajustes,
    )
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('renderiza sin lanzar cuando faltan datos opcionales', async () => {
    const buffer = await renderReciboPdf(
      { ...pedido, clienteCedula: null, observaciones: null, transportadora: null }, ajustes,
    )
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
