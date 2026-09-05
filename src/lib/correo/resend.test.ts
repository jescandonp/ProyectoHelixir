// src/lib/correo/resend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// `vi.mock` se sube (hoist) al principio del archivo automáticamente en
// Vitest, así que este mock aplica también al `import` de más abajo aunque
// aparezca antes en el código fuente.
const enviarMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: enviarMock } }
  }),
}))

import { enviarCorreoConAdjunto } from './resend'

describe('enviarCorreoConAdjunto', () => {
  beforeEach(() => {
    enviarMock.mockReset()
    process.env.RESEND_API_KEY = 'clave-de-prueba'
    delete process.env.RESEND_FROM_EMAIL
  })

  it('envía con el remitente por defecto cuando no hay RESEND_FROM_EMAIL', async () => {
    enviarMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    await enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com',
      asunto: 'Recibo de tu pedido PED-000148',
      textoPlano: 'Hola',
      adjunto: { nombreArchivo: 'PED-000148.pdf', contenido: Buffer.from('contenido') },
    })

    expect(enviarMock).toHaveBeenCalledWith({
      from: 'onboarding@resend.dev',
      to: 'cliente@correo.com',
      subject: 'Recibo de tu pedido PED-000148',
      text: 'Hola',
      attachments: [{ filename: 'PED-000148.pdf', content: Buffer.from('contenido') }],
    })
  })

  it('usa RESEND_FROM_EMAIL cuando está configurado', async () => {
    process.env.RESEND_FROM_EMAIL = 'pedidos@minegocio.com'
    enviarMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    await enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })

    expect(enviarMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'pedidos@minegocio.com' }))
  })

  it('lanza un error legible cuando Resend responde con error', async () => {
    enviarMock.mockResolvedValue({ data: null, error: { message: 'dominio no verificado' } })

    await expect(enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })).rejects.toThrow('dominio no verificado')
  })

  it('lanza si falta RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY
    await expect(enviarCorreoConAdjunto({
      destinatario: 'cliente@correo.com', asunto: 'Asunto', textoPlano: 'Texto',
      adjunto: { nombreArchivo: 'a.pdf', contenido: Buffer.from('x') },
    })).rejects.toThrow('RESEND_API_KEY')
  })
})
