import Link from 'next/link'
import { BOTON_SECUNDARIO } from '@/components/estilos'

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
    <div className="mt-4 flex items-center justify-center gap-3">
      {pagina > 0 && (
        <Link href={enlace(pagina - 1)} className={BOTON_SECUNDARIO}>
          ← Anterior
        </Link>
      )}
      <span className="text-etiqueta-md text-tinta-tenue">
        Página {pagina + 1} de {paginas} · {total} {sustantivo}
      </span>
      {pagina + 1 < paginas && (
        <Link href={enlace(pagina + 1)} className={BOTON_SECUNDARIO}>
          Siguiente →
        </Link>
      )}
    </div>
  )
}
