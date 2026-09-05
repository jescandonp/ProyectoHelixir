import Link from 'next/link'
import { listarClientes } from '@/lib/db/clientes'
import { CLIENTES_POR_PAGINA, sanearPagina } from '@/lib/db/paginacion'
import { BuscadorListado } from '@/components/clientes/BuscadorListado'
import { Paginacion } from '@/components/Paginacion'
import { TARJETA, CHIP_CODIGO } from '@/components/estilos'
import { IconoTelefono, IconoPin } from '@/components/iconos'

type Params = Promise<Record<string, string | undefined>>

export default async function PaginaClientes({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams
  const pagina = sanearPagina(sp.pagina)
  const { filas, total } = await listarClientes(sp.q ?? '', pagina)
  const paginas = Math.ceil(total / CLIENTES_POR_PAGINA)

  function enlacePagina(n: number) {
    const nuevos = new URLSearchParams()
    if (sp.q) nuevos.set('q', sp.q)
    nuevos.set('pagina', String(n))
    return `/clientes?${nuevos.toString()}`
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10">
      <h1 className="mb-6 font-titulo text-titulo-lg-mobile text-tinta md:text-titulo-lg">
        Clientes
      </h1>

      <BuscadorListado />

      {filas.length === 0 && (
        <p className={`${TARJETA} px-4 py-10 text-center text-cuerpo-md text-tinta-tenue`}>
          No hay clientes
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filas.map((cliente) => (
          <Link
            key={cliente.id} href={`/clientes/${cliente.id}`}
            className={`${TARJETA} block p-5 transition-shadow hover:shadow-nivel2`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="font-titulo text-cuerpo-lg text-tinta">{cliente.nombre}</span>
              <span className={CHIP_CODIGO}>{cliente.codigo}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-etiqueta-lg font-medium tracking-normal text-tinta-suave">
              <span className="flex items-center gap-1.5">
                <IconoTelefono className="h-4 w-4 shrink-0" />
                {cliente.telefono ?? 'sin teléfono'}
              </span>
              <span className="flex items-center gap-1.5">
                <IconoPin className="h-4 w-4 shrink-0" />
                {cliente.direcciones?.[0]?.ciudad ?? 'sin ciudad'}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Paginacion
        pagina={pagina} paginas={paginas} total={total}
        sustantivo="clientes" enlace={enlacePagina}
      />
    </div>
  )
}
