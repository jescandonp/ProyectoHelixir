import { NextRequest, NextResponse } from 'next/server'
import { listarPedidosParaExportar } from '@/lib/db/pedidos-consultas'
import { rangoDelDia, rangoEntre, diaEnBogota } from '@/lib/periodo'
import { fechaValida, estadoPagoValido } from '@/lib/pedidos/filtros-url'
import { generarExcelPedidos } from '@/lib/documentos/a-excel'
import { renderListadoPedidosPdf } from '@/lib/documentos/pdf/ListadoPedidosPdf'
import type { EstadoPedido } from '@/lib/tipos'

const TITULOS_PESTANA: Record<string, string> = {
  hoy: 'Pedidos — Hoy',
  porcobrar: 'Pedidos — Por cobrar',
  todos: 'Pedidos — Todos',
}

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

function formatearFechaTitulo(dia: string): string {
  const [anio, mes, diaMes] = dia.split('-')
  return `${diaMes}/${mes}/${anio}`
}

/** El título fijo por pestaña ("Pedidos — Hoy") deja de ser cierto en cuanto
 *  el usuario aplica un rango de fechas manual sobre esa pestaña —
 *  `FiltrosPedidos.tsx` conserva `pestana` al elegir fechas a mano, así que
 *  sin esto un PDF con quince días de datos podría salir titulado "Hoy". Si
 *  hay un rango válido (`desde`/`hasta`, ya validados por `fechaValida`), el
 *  título lo refleja; si no, se usa el nombre fijo de la pestaña. */
function tituloDelPdf(pestana: string, desde: string | undefined, hasta: string | undefined): string {
  if (desde && hasta) return `Pedidos — ${formatearFechaTitulo(desde)} al ${formatearFechaTitulo(hasta)}`
  if (desde) return `Pedidos — desde ${formatearFechaTitulo(desde)}`
  if (hasta) return `Pedidos — hasta ${formatearFechaTitulo(hasta)}`
  return TITULOS_PESTANA[pestana] ?? 'Pedidos'
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

  const buffer = await renderListadoPedidosPdf(filas, tituloDelPdf(pestana, desde, hasta))
  return new NextResponse(cuerpoBinario(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.pdf"`,
    },
  })
}
