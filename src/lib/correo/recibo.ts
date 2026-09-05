// src/lib/correo/recibo.ts
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import type { CorreoConAdjunto } from './resend'

export function construirCorreoRecibo(
  pedido: PedidoCompleto,
  ajustes: Ajustes,
  pdf: Buffer,
): CorreoConAdjunto {
  if (!pedido.clienteCorreo) {
    throw new Error('Este cliente no tiene correo registrado')
  }

  return {
    destinatario: pedido.clienteCorreo,
    asunto: `Recibo de tu pedido ${pedido.consecutivo} — ${ajustes.nombreNegocio}`,
    textoPlano:
      `Hola ${pedido.clienteNombre}, adjunto el recibo de tu pedido ${pedido.consecutivo}.\n\n${ajustes.pieRecibo}`,
    adjunto: {
      nombreArchivo: `${pedido.consecutivo ?? pedido.id}.pdf`,
      contenido: pdf,
    },
  }
}
