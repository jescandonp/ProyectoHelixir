'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/** Se dispara cuando falla una lectura del servidor a Supabase (un
 *  microcorte de red, un desfase de reloj, etc.) y el render de la página
 *  se cae. Sin este archivo, Next muestra su página de error genérica en
 *  inglés a mitad de la toma de un pedido. */
export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-black px-6 py-5 text-center text-white">
          <p className="text-2xl font-black tracking-tight">Algo falló</p>
        </div>

        <div className="space-y-4 px-6 py-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            No se pudo cargar la información. Puede ser un corte breve de conexión
            con la base de datos.
          </p>
          <p className="text-sm text-slate-700">
            Tu sesión sigue activa: puedes reintentar sin perder nada.
          </p>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-black py-2.5 font-bold text-white transition"
          >
            Reintentar
          </button>

          <Link
            href="/pedidos/nuevo"
            className="block w-full rounded-lg border-2 border-slate-300 py-2.5 font-bold text-slate-900 transition hover:bg-slate-50"
          >
            Volver a tomar pedidos
          </Link>
        </div>
      </div>
    </main>
  )
}
