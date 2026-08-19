import { listarPedidos, resumenPorCobrar } from '@/lib/db/pedidos-consultas'
import { POR_PAGINA, sanearPagina } from '@/lib/db/paginacion'
import { rangoDelDia, rangoEntre } from '@/lib/periodo'
import { formatearPesos } from '@/lib/dinero'
import { FiltrosPedidos } from '@/components/pedidos/FiltrosPedidos'
import { FilaPedido } from '@/components/pedidos/FilaPedido'
import { TarjetaPedido } from '@/components/pedidos/TarjetaPedido'
import { Paginacion } from '@/components/Paginacion'
import { TARJETA } from '@/components/estilos'
import type { EstadoPedido, EstadoPago } from '@/lib/tipos'

const ESTADOS_PAGO: EstadoPago[] = ['pendiente', 'contraentrega', 'pagado']

/** Un valor fuera de esta lista (URL retocada a mano) se ignora en vez de
 *  romper la pantalla, igual que ya hace `fechaValida` con las fechas. */
function estadoPagoValido(valor: string | undefined): EstadoPago | undefined {
  return ESTADOS_PAGO.includes(valor as EstadoPago) ? (valor as EstadoPago) : undefined
}

type Params = Promise<Record<string, string | undefined>>

/** Descarta los indefinidos: sin esto la URL termina con `?estado=undefined`. */
function conservar(sp: Record<string, string | undefined>): URLSearchParams {
  const limpios = new URLSearchParams()
  for (const [clave, valor] of Object.entries(sp)) {
    if (valor) limpios.set(clave, valor)
  }
  return limpios
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
      estadoPago: estadoPagoValido(sp.estadoPago),
      // `clienteId` y `asesorId` no tienen control visible en esta pantalla:
      // son filtros solo por URL, para que otras pantallas (ficha del
      // cliente, panel del asesor) enlacen aquí ya filtrado.
      clienteId: sp.clienteId || undefined,
      asesorId: sp.asesorId || undefined,
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

  const vacio = filas.length === 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-titulo text-titulo-lg-mobile text-tinta md:text-titulo-lg">Pedidos</h1>

        {/* Este total es de todo lo pendiente, sin filtro de fechas ni
            pestaña: es plata real que debe verse siempre, aunque la lista
            de abajo esté filtrada y muestre menos pedidos. */}
        <div className={`${TARJETA} border border-borde-suave px-5 py-3 text-right`}>
          <span className="block text-etiqueta-md uppercase tracking-[0.08em] text-terciario">
            Por cobrar
          </span>
          <span className="font-titulo text-titulo-md tabular-nums text-tinta">
            {formatearPesos(porCobrar.total)}
          </span>
          <span className="ml-2 text-etiqueta-md text-tinta-tenue">
            {porCobrar.pedidos} pedido{porCobrar.pedidos === 1 ? '' : 's'}
          </span>
          <span className="mt-0.5 block text-etiqueta-md text-tinta-suave">
            Total pendiente de siempre, no solo de lo filtrado
          </span>
        </div>
      </div>

      <FiltrosPedidos />

      {vacio && (
        <p className={`${TARJETA} px-4 py-10 text-center text-cuerpo-md text-tinta-tenue`}>
          No hay pedidos con esos filtros
        </p>
      )}

      {/* Dos presentaciones del mismo listado: siete columnas no caben en un
          celular, y una lista de tarjetas se vuelve ilegible en pantalla
          ancha. Solo una de las dos está en el DOM visible a la vez. */}
      {!vacio && (
        <>
          <div className={`${TARJETA} hidden overflow-x-auto md:block`}>
            <table className="w-full">
              <thead className="border-b border-borde-suave bg-tarjeta-baja text-left text-etiqueta-md uppercase tracking-[0.08em] text-tinta-suave">
                <tr>
                  <th className="px-3 py-3 font-semibold">Orden</th>
                  <th className="px-3 py-3 font-semibold">Fecha</th>
                  <th className="px-3 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 text-right font-semibold">Kg</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-3 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((pedido) => <FilaPedido key={pedido.id} pedido={pedido} />)}
              </tbody>
            </table>
          </div>

          <ul className={`${TARJETA} overflow-hidden md:hidden`}>
            {filas.map((pedido) => <TarjetaPedido key={pedido.id} pedido={pedido} />)}
          </ul>
        </>
      )}

      <Paginacion
        pagina={pagina} paginas={paginas} total={total}
        sustantivo="pedidos" enlace={enlacePagina}
      />
    </div>
  )
}
