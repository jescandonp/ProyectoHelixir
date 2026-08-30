import { NextRequest, NextResponse } from 'next/server'
import { listarPedidosParaExportar } from '@/lib/db/pedidos-consultas'
import { rangoDelDia, rangoEntre } from '@/lib/periodo'
import { fechaValida, estadoPagoValido } from '@/lib/pedidos/filtros-url'
import { generarExcelPedidos } from '@/lib/documentos/a-excel'
import { renderListadoPedidosPdf } from '@/lib/documentos/pdf/ListadoPedidosPdf'
import type { EstadoPedido } from '@/lib/tipos'

const TITULOS_PESTANA: Record<string, string> = {
  hoy: 'Pedidos — Hoy',
  porcobrar: 'Pedidos — Por cobrar',
  todos: 'Pedidos — Todos',
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const formato = sp.get('formato')
  if (formato !== 'excel' && formato !== 'pdf') {
    return NextResponse.json({ error: 'formato debe ser "excel" o "pdf"' }, { status: 400 })
  }

  const pestana = sp.get('pestana') ?? 'hoy'
  const desde = fechaValida(sp.get('desde') ?? undefined)
  const hasta = fechaValida(sp.get('hasta') ?? undefined)

  const rango =
    desde && hasta ? rangoEntre(desde, hasta)
    : pestana === 'hoy' ? rangoDelDia()
    : undefined

  const filas = await listarPedidosParaExportar({
    rango,
    estado: (sp.get('estado') as EstadoPedido | undefined) || undefined,
    estadoPago: estadoPagoValido(sp.get('estadoPago') ?? undefined),
    clienteId: sp.get('clienteId') || undefined,
    asesorId: sp.get('asesorId') || undefined,
    soloPorCobrar: pestana === 'porcobrar',
  })

  const nombreArchivo = `pedidos-${new Date().toISOString().slice(0, 10)}`

  if (formato === 'excel') {
    const buffer = await generarExcelPedidos(filas)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    })
  }

  const buffer = await renderListadoPedidosPdf(filas, TITULOS_PESTANA[pestana] ?? 'Pedidos')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
    },
  })
}
