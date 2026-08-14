'use client'

import { useState } from 'react'
import type { Producto } from '@/lib/tipos'
import { formatearPesos } from '@/lib/dinero'

interface Props {
  productos: Producto[]
  cantidades: Record<string, number>
  onSumar: (producto: Producto) => void
  onRestar: (producto: Producto) => void
  onItemLibre: (descripcion: string, precio: number) => void
}

export function GrillaSabores({ productos, cantidades, onSumar, onRestar, onItemLibre }: Props) {
  const [filtro, setFiltro] = useState('')
  const [abriendoLibre, setAbriendoLibre] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')

  const visibles = productos.filter((p) =>
    p.nombre.toLowerCase().includes(filtro.trim().toLowerCase()),
  )

  const porPrecio = visibles.reduce<Record<number, Producto[]>>((grupos, producto) => {
    ;(grupos[producto.precio] ??= []).push(producto)
    return grupos
  }, {})

  function agregarLibre() {
    const valor = Number(precio.replace(/\D/g, ''))
    if (!descripcion.trim() || valor <= 0) return
    onItemLibre(descripcion.trim(), valor)
    setDescripcion(''); setPrecio(''); setAbriendoLibre(false)
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <input
        value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Escribe para filtrar sabores…"
        className="mb-3 w-full rounded border px-2 py-1.5 text-sm"
      />

      {Object.entries(porPrecio)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([precioGrupo, delGrupo]) => (
          <div key={precioGrupo} className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold text-slate-400">
              {formatearPesos(Number(precioGrupo))}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {delGrupo.map((producto) => {
                const cantidad = cantidades[producto.id] ?? 0
                return (
                  <button
                    key={producto.id} type="button"
                    onClick={() => onSumar(producto)}
                    onContextMenu={(e) => { e.preventDefault(); onRestar(producto) }}
                    className={`relative rounded-md border px-1.5 py-2 text-xs ${
                      cantidad > 0
                        ? 'border-blue-600 bg-blue-600 font-semibold text-white'
                        : 'border-slate-200 text-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {producto.nombre} {producto.emoji}
                    {cantidad > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 min-w-[19px] rounded-full bg-red-600 text-[11px] leading-[19px] text-white">
                        {cantidad}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      {abriendoLibre ? (
        <div className="flex gap-2 rounded-md border border-dashed border-amber-500 bg-amber-50 p-2">
          <input autoFocus value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué es" className="flex-1 rounded border px-2 py-1 text-sm" />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio" inputMode="numeric" className="w-24 rounded border px-2 py-1 text-sm" />
          <button type="button" onClick={agregarLibre}
            className="rounded bg-amber-600 px-3 text-sm font-semibold text-white">Agregar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAbriendoLibre(true)}
          className="w-full rounded-md border border-dashed border-amber-500 bg-amber-50 py-2 text-xs font-semibold text-amber-700">
          ＋ Ítem libre
        </button>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Clic para sumar · clic derecho para restar
      </p>
    </div>
  )
}
