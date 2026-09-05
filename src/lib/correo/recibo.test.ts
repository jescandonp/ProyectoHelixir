// src/lib/correo/recibo.test.ts
import { describe, it, expect } from 'vitest'
import { construirCorreoRecibo } from './recibo'
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
  estado: 'confirmado', estadoPago: 'pendiente', tipoEntrega: 'local',
  transportadora: null, fechaPago: null,
  clienteCodigo: 'CL-0042', clienteNombre: 'Juanito González',
  clienteTelefono: '312 456 7890', clienteCedula: '1017456789',
  clienteCorreo: 'juanito@correo.com',
  dirLinea: 'Cra 45 # 23-18', dirBarrio: 'La Floresta', dirCiudad: 'Medellín',
  dirDepartamento: 'Antioquia', dirIndicaciones: null,
  asesorCodigo: '002', valorDomicilio: 8000, descuento: 0,
  subtotal: 232000, total: 240000, totalKg: 10, observaciones: null,
  items: [],
}

const pdf = Buffer.from('contenido-del-pdf')

describe('construirCorreoRecibo', () => {
  it('arma el correo con el destinatario, asunto y adjunto correctos', () => {
    const correo = construirCorreoRecibo(pedido, ajustes, pdf)

    expect(correo.destinatario).toBe('juanito@correo.com')
    expect(correo.asunto).toBe('Recibo de tu pedido PED-000148 — MI NEGOCIO')
    expect(correo.adjunto).toEqual({ nombreArchivo: 'PED-000148.pdf', contenido: pdf })
    expect(correo.textoPlano).toContain('PED-000148')
    expect(correo.textoPlano).toContain('Gracias por su compra')
  })

  it('lanza si el pedido no tiene correo', () => {
    expect(() => construirCorreoRecibo({ ...pedido, clienteCorreo: null }, ajustes, pdf))
      .toThrow('Este cliente no tiene correo registrado')
  })

  it('incluye el descuento positivo en el desglose del correo', () => {
    const correo = construirCorreoRecibo(
      { ...pedido, descuento: 4000, total: 236000 }, ajustes, pdf,
    )

    expect(correo.textoPlano).toContain('Descuento: -$ 4.000')
  })
})
