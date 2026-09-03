import { NextRequest, NextResponse } from 'next/server'
import { obtenerPedido } from '@/lib/db/pedidos'
import { obtenerAjustes } from '@/lib/db/ajustes'
import { renderReciboPdf } from '@/lib/documentos/pdf/ReciboPdf'

function cuerpoBinario(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [pedido, ajustes] = await Promise.all([obtenerPedido(id), obtenerAjustes()])
  if (!pedido) return NextResponse.json({ error: 'No se encontró el pedido' }, { status: 404 })

  const buffer = await renderReciboPdf(pedido, ajustes)
  return new NextResponse(cuerpoBinario(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pedido.consecutivo ?? id}.pdf"`,
    },
  })
}
