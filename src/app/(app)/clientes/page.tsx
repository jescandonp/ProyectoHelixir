import Link from 'next/link'
import { listarClientes } from '@/lib/db/clientes'
import { CLIENTES_POR_PAGINA, sanearPagina } from '@/lib/db/paginacion'
import { BuscadorListado } from '@/components/clientes/BuscadorListado'
import { Paginacion } from '@/components/Paginacion'

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
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 text-lg font-bold">Clientes</h1>

      <BuscadorListado />

      <div className="overflow-hidden rounded-lg border bg-white">
        {filas.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-400">No hay clientes</p>
        )}
        {filas.map((cliente) => (
          <Link key={cliente.id} href={`/clientes/${cliente.id}`}
            className="flex items-center justify-between border-b px-3 py-2 text-sm hover:bg-slate-50">
            <span>
              <span className="block font-semibold">{cliente.nombre}</span>
              <span className="block text-xs text-slate-500">
                {cliente.telefono ?? 'sin teléfono'} · {cliente.direcciones?.[0]?.ciudad ?? 'sin ciudad'}
              </span>
            </span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
              {cliente.codigo}
            </span>
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
