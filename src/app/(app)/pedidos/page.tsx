import { listarPedidos, resumenPorCobrar } from '@/lib/db/pedidos-consultas'
import { POR_PAGINA } from '@/lib/db/paginacion'
import { rangoDelDia, rangoEntre } from '@/lib/periodo'
import { formatearPesos } from '@/lib/dinero'
import { FiltrosPedidos } from '@/components/pedidos/FiltrosPedidos'
import { FilaPedido } from '@/components/pedidos/FilaPedido'
import { Paginacion } from '@/components/Paginacion'
import type { EstadoPedido } from '@/lib/tipos'

type Params = Promise<Record<string, string | undefined>>

/** Descarta los indefinidos: sin esto la URL termina con `?estado=undefined`. */
function conservar(sp: Record<string, string | undefined>): URLSearchParams {
  const limpios = new URLSearchParams()
  for (const [clave, valor] of Object.entries(sp)) {
    if (valor) limpios.set(clave, valor)
  }
  return limpios
}

// La URL de esta pantalla está pensada para compartirse por chat, así que
// llega como entrada de usuario real: puede traer cualquier cosa. Una
// página que no sea un entero >= 0 no debe tumbar la pantalla, cae a la
// primera.
function sanearPagina(valor: string | undefined): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : 0
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Exige la forma AAAA-MM-DD y que sea una fecha real (rechaza p.ej.
 *  "2026-02-30", que `Date` normalizaría en vez de rechazar). Una fecha
 *  inválida en la URL no debe romper la pantalla: se ignora y `page.tsx`
 *  cae al comportamiento de la pestaña, en vez de dejar que `rangoEntre`
 *  reviente con un `RangeError` al construir el ISO. */
function fechaValida(valor: string | undefined): string | undefined {
  if (!valor || !FORMATO_FECHA.test(valor)) return undefined
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const esReal =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  return esReal ? valor : undefined
}

export default async function PaginaPedidos({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const pestana = sp.pestana ?? 'hoy'
  const pagina = sanearPagina(sp.pagina)

  const desde = fechaValida(sp.desde)
  const hasta = fechaValida(sp.hasta)

  const rango =
    desde && hasta ? rangoEntre(desde, hasta)
    : pestana === 'hoy' ? rangoDelDia()
    : undefined

  const [{ filas, total }, porCobrar] = await Promise.all([
    listarPedidos({
      rango,
      estado: (sp.estado as EstadoPedido | undefined) || undefined,
      soloPorCobrar: pestana === 'porcobrar',
      pagina,
    }),
    resumenPorCobrar(),
  ])

  const paginas = Math.ceil(total / POR_PAGINA)

  function enlacePagina(n: number) {
    const nuevos = conservar(sp)
    nuevos.set('pagina', String(n))
    return `/pedidos?${nuevos.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Pedidos</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-right">
          <span className="block text-[10px] font-bold tracking-wider text-amber-700">
            POR COBRAR
          </span>
          <span className="text-lg font-extrabold tabular-nums text-amber-800">
            {formatearPesos(porCobrar.total)}
          </span>
          <span className="ml-2 text-xs text-amber-700">
            {porCobrar.pedidos} pedido{porCobrar.pedidos === 1 ? '' : 's'}
          </span>
          {/* Este total es de todo lo pendiente, sin filtro de fechas ni
              pestaña: es plata real que debe verse siempre, aunque la lista
              de abajo esté filtrada y muestre menos pedidos. */}
          <span className="block text-[10px] text-amber-600">
            Total pendiente de siempre, no solo de lo filtrado
          </span>
        </div>
      </div>

      <FiltrosPedidos />

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-slate-50 text-left text-[10px] font-bold tracking-wider text-slate-500">
            <tr>
              <th className="px-2 py-2">ORDEN</th>
              <th className="px-2 py-2">FECHA</th>
              <th className="px-2 py-2">CLIENTE</th>
              <th className="px-2 py-2 text-right">KG</th>
              <th className="px-2 py-2 text-right">TOTAL</th>
              <th className="px-2 py-2">ESTADO</th>
              <th className="px-2 py-2">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-6 text-center text-sm text-slate-400">
                No hay pedidos con esos filtros
              </td></tr>
            )}
            {filas.map((pedido) => <FilaPedido key={pedido.id} pedido={pedido} />)}
          </tbody>
        </table>
      </div>

      <Paginacion
        pagina={pagina} paginas={paginas} total={total}
        sustantivo="pedidos" enlace={enlacePagina}
      />
    </div>
  )
}
