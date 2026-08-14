import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Recibo } from './Recibo'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22 - 313 880 88 62', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias por su compra',
}

const pedido: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: 'Pago contraentrega',
  items: [
    { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
    { productoId: 'b', descripcion: 'Frutos Rojos', cantidad: 2, precioUnitario: 22000, subtotal: 44000 },
    { productoId: 'c', descripcion: 'Maracuyá', cantidad: 4, precioUnitario: 25000, subtotal: 100000 },
  ],
}

describe('Recibo', () => {
  it('muestra el consecutivo', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText(/PED-000148/)).toBeDefined()
  })

  it('muestra el total y el total en letras', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('$ 240.000')).toBeDefined()
    expect(screen.getByText('Doscientos cuarenta mil M/cte')).toBeDefined()
  })

  it('resume los kilos arriba del detalle', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText(/10 Kg/)).toBeDefined()
  })

  it('enmascara la cédula dejando solo los primeros cuatro dígitos', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('1017xxxxxx')).toBeDefined()
    expect(screen.queryByText('1017456789')).toBeNull()
  })

  it('muestra PENDIENTE DE PAGO con los datos de pago cuando no está pagado', () => {
    render(<Recibo pedido={pedido} ajustes={ajustes} />)
    expect(screen.getByText('PENDIENTE DE PAGO')).toBeDefined()
    expect(screen.getByText(/Nequi 305 724 10 22/)).toBeDefined()
  })

  it('muestra PAGADO cuando el pedido ya se pagó', () => {
    render(
      <Recibo
        pedido={{ ...pedido, estadoPago: 'pagado', fechaPago: '2026-08-11T22:00:00.000Z' }}
        ajustes={ajustes}
      />,
    )
    expect(screen.getByText(/PAGADO/)).toBeDefined()
    expect(screen.queryByText('PENDIENTE DE PAGO')).toBeNull()
  })

  it('muestra el precio unitario solo cuando la cantidad es mayor a 1', () => {
    render(
      <Recibo
        pedido={{
          ...pedido,
          items: [
            { productoId: 'a', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000, subtotal: 88000 },
            { productoId: 'b', descripcion: 'Coco', cantidad: 1, precioUnitario: 22000, subtotal: 22000 },
          ],
        }}
        ajustes={ajustes}
      />,
    )
    expect(screen.getByText('4 kg × $ 22.000')).toBeDefined()
    expect(screen.queryByText('1 kg × $ 22.000')).toBeNull()
  })
})
