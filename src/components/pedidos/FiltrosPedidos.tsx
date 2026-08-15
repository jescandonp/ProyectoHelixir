'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PESTANAS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'porcobrar', texto: 'Por cobrar' },
  { clave: 'todos', texto: 'Todos' },
]

const ESTADOS = ['confirmado', 'enviado', 'entregado', 'anulado']

export function FiltrosPedidos() {
  const router = useRouter()
  const params = useSearchParams()
  const pestanaActual = params.get('pestana') ?? 'hoy'

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    nuevos.delete('pagina')   // cambiar de filtro vuelve a la primera página
    router.push(`/pedidos?${nuevos.toString()}`)
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="flex gap-1">
        {PESTANAS.map(({ clave, texto }) => (
          <button
            key={clave} type="button" onClick={() => cambiar('pestana', clave)}
            className={`rounded-md px-4 py-1.5 text-sm ${
              pestanaActual === clave
                ? 'bg-slate-900 font-semibold text-white'
                : 'border bg-white text-slate-700'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="date" value={params.get('desde') ?? ''}
          onChange={(e) => cambiar('desde', e.target.value)}
          className="rounded border px-2 py-1"
        />
        <span className="text-slate-400">a</span>
        <input
          type="date" value={params.get('hasta') ?? ''}
          onChange={(e) => cambiar('hasta', e.target.value)}
          className="rounded border px-2 py-1"
        />
        <select
          value={params.get('estado') ?? ''}
          onChange={(e) => cambiar('estado', e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
    </div>
  )
}
