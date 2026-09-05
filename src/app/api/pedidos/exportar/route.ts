import { NextRequest, NextResponse } from 'next/server'
import { listarPedidosParaExportar } from '@/lib/db/pedidos-consultas'
import { rangoDelDia, rangoEntre, diaEnBogota } from '@/lib/periodo'
import { fechaValida, estadoPagoValido } from '@/lib/pedidos/filtros-url'
import { tituloDelPdf } from '@/lib/pedidos/titulo-exportacion'
import { generarExcelPedidos } from '@/lib/documentos/a-excel'
import { renderListadoPedidosPdf } from '@/lib/documentos/pdf/ListadoPedidosPdf'
import type { EstadoPedido } from '@/lib/tipos'

// exceljs/index.d.ts sombrea `Buffer` globalmente (extends ArrayBuffer), así
// que el `Buffer` real de @types/node que devuelven `generarExcelPedidos` y
// `renderListadoPedidosPdf` ya no encaja con la firma de `NextResponse` — un
// bug conocido de los tipos de exceljs, no del código (ver `a-excel.test.ts`
// y las Global Constraints del plan). `Uint8Array` rodea el problema sin
// tocar los bytes en tiempo de ejecución. La anotación explícita
// `Uint8Array<ArrayBuffer>` (en vez de dejar que TS infiera el genérico por
// defecto) importa: sin ella, sacar esta expresión de la llamada a
// `new NextResponse(...)` pierde el tipado contextual que antes la hacía
// encajar, y `npm run build` vuelve a fallar con TS2345.
function cuerpoBinario(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer)
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

  const hayRangoManual = Boolean(desde && hasta)
  const rango =
    hayRangoManual && desde && hasta ? rangoEntre(desde, hasta)
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

  // Colombia es UTC-5: con la fecha UTC, entre las 7 p.m. y medianoche
  // locales el archivo se nombraría con la fecha de mañana, mientras el
  // contenido (pestaña "Hoy") ya usa el día civil en Bogotá vía
  // `rangoDelDia()`. `diaEnBogota` mantiene ambos consistentes.
  const nombreArchivo = `pedidos-${diaEnBogota(new Date())}`

  if (formato === 'excel') {
    const buffer = await generarExcelPedidos(filas)
    return new NextResponse(cuerpoBinario(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    })
  }

  const buffer = await renderListadoPedidosPdf(filas, tituloDelPdf(pestana, desde, hasta, hayRangoManual))
  return new NextResponse(cuerpoBinario(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
    },
  })
}
