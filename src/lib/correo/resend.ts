// src/lib/correo/resend.ts
import { Resend } from 'resend'

const REMITENTE_POR_DEFECTO = 'onboarding@resend.dev'

export interface CorreoConAdjunto {
  destinatario: string
  asunto: string
  textoPlano: string
  adjunto: { nombreArchivo: string; contenido: Buffer }
}

export async function enviarCorreoConAdjunto(datos: CorreoConAdjunto): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Falta configurar RESEND_API_KEY')

  const resend = new Resend(apiKey)
  const remitente = process.env.RESEND_FROM_EMAIL || REMITENTE_POR_DEFECTO

  const { error } = await resend.emails.send({
    from: remitente,
    to: datos.destinatario,
    subject: datos.asunto,
    text: datos.textoPlano,
    attachments: [{ filename: datos.adjunto.nombreArchivo, content: datos.adjunto.contenido }],
  })

  if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`)
}
