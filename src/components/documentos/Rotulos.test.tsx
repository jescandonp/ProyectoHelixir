import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RotuloLocal } from './RotuloLocal'
import { RotuloNacional } from './RotuloNacional'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

const ajustes: Ajustes = {
  nombreNegocio: 'MI NEGOCIO', eslogan: 'Helado Artesanal', logoUrl: null,
  telefonos: '305 724 10 22', datosPago: 'Nequi 305 724 10 22',
  prefijoConsecutivo: 'PED', valorDomicilioDefault: 8000,
  etiquetaAnchoMm: 100, etiquetaAltoMm: 150, pieRecibo: 'Gracias',
}

const base: PedidoCompleto = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  estado: 'confirmado', estadoPago: 'contraentrega', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: 'Portería, timbre 302',
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: null, items: [],
}

describe('RotuloLocal', () => {
  it('nunca imprime la cédula: imprime el código de cliente', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.queryByText(/1017456789/)).toBeNull()
    expect(screen.getByText('CL-0042')).toBeDefined()
  })

  // El `uppercase` es de CSS y no cambia el texto del DOM: se afirma el texto real.
  it('destaca el barrio, que es por donde navega el mensajero', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText('La Floresta')).toBeDefined()
  })

  it('muestra el valor a cobrar cuando es contraentrega', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText('COBRAR CONTRAENTREGA')).toBeDefined()
    expect(screen.getByText('$ 240.000')).toBeDefined()
  })

  it('no muestra valor a cobrar si el pedido ya está pagado', () => {
    render(<RotuloLocal pedido={{ ...base, estadoPago: 'pagado' }} ajustes={ajustes} />)
    expect(screen.queryByText('COBRAR CONTRAENTREGA')).toBeNull()
  })

  it('lleva las indicaciones de entrega', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText(/Portería, timbre 302/)).toBeDefined()
  })

  it('lleva el aviso de congelado', () => {
    render(<RotuloLocal pedido={base} ajustes={ajustes} />)
    expect(screen.getByText(/CONGELADO/)).toBeDefined()
  })
})

describe('RotuloNacional', () => {
  const nacional: PedidoCompleto = {
    ...base, tipoEntrega: 'nacional', transportadora: 'ForEnvíos',
    dirCiudad: 'Barranquilla', dirDepartamento: 'Atlántico',
  }

  it('nunca imprime la cédula', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.queryByText(/1017456789/)).toBeNull()
    expect(screen.getByText('CL-0042')).toBeDefined()
  })

  it('destaca la ciudad, que es por donde clasifica la transportadora', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText('Barranquilla')).toBeDefined()
  })

  it('NUNCA muestra el valor: la plata la maneja la transportadora', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.queryByText('$ 240.000')).toBeNull()
    expect(screen.queryByText(/COBRAR/)).toBeNull()
  })

  it('lleva remitente, obligatorio para devoluciones', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText(/REMITE/)).toBeDefined()
    // Aparece dos veces: en el encabezado y en el remitente.
    expect(screen.getAllByText(/MI NEGOCIO/)).toHaveLength(2)
  })

  it('lleva el aviso de cadena de frío en grande', () => {
    render(<RotuloNacional pedido={nacional} ajustes={ajustes} />)
    expect(screen.getByText(/PRODUCTO CONGELADO/)).toBeDefined()
    expect(screen.getByText(/CADENA DE FRÍO/)).toBeDefined()
  })
})
