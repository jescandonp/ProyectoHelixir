import Link from 'next/link'

export function Paginacion({
  pagina, paginas, total, sustantivo, enlace,
}: {
  pagina: number
  paginas: number
  total: number
  /** Plural: "pedidos", "clientes". */
  sustantivo: string
  enlace: (n: number) => string
}) {
  if (paginas <= 1) return null

  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      {pagina > 0 && (
        <Link href={enlace(pagina - 1)} className="rounded border bg-white px-3 py-1">
          ← Anterior
        </Link>
      )}
      <span className="text-slate-500">
        Página {pagina + 1} de {paginas} · {total} {sustantivo}
      </span>
      {pagina + 1 < paginas && (
        <Link href={enlace(pagina + 1)} className="rounded border bg-white px-3 py-1">
          Siguiente →
        </Link>
      )}
    </div>
  )
}
