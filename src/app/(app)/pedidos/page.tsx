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

export default async function PaginaPedidos({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const pestana = sp.pestana ?? 'hoy'
  const pagina = Number(sp.pagina ?? 0)

  const rango =
    sp.desde && sp.hasta ? rangoEntre(sp.desde, sp.hasta)
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
