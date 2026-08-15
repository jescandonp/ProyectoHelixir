'use client'

import { useState } from 'react'
import type { Producto } from '@/lib/tipos'
import { formatearPesos } from '@/lib/dinero'
import { CAMPO, CAMPO_CHICO, BOTON_PRIMARIO } from '@/components/estilos'

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
    <div>
      <input
        value={filtro} onChange={(e) => setFiltro(e.target.value)}
        placeholder="Escribe para filtrar sabores…"
        aria-label="Filtrar sabores"
        className={`${CAMPO} mb-4`}
      />

      {Object.entries(porPrecio)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([precioGrupo, delGrupo]) => (
          <div key={precioGrupo} className="mb-4">
            <p className="mb-2 text-etiqueta-lg text-primario">
              {formatearPesos(Number(precioGrupo))}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {delGrupo.map((producto) => {
                const cantidad = cantidades[producto.id] ?? 0
                return (
                  <button
                    key={producto.id} type="button"
                    onClick={() => onSumar(producto)}
                    onContextMenu={(e) => { e.preventDefault(); onRestar(producto) }}
                    // El borde de 2px existe siempre, seleccionado o no: si
                    // apareciera solo al escoger, la pastilla daría un salto
                    // de un píxel y la grilla entera bailaría al hacer clic.
                    className={`relative rounded-md border-2 px-2 py-3 text-etiqueta-lg tracking-normal transition-all ${
                      cantidad > 0
                        ? 'border-primario bg-primario-fijo text-sobre-primario-fijo shadow-nivel2'
                        : 'border-transparent bg-tarjeta-baja text-tinta hover:border-primario-fijo-tenue'
                    }`}
                  >
                    {producto.nombre} {producto.emoji}
                    {cantidad > 0 && (
                      <span className="absolute -right-2 -top-2 min-w-[22px] rounded-full bg-primario px-1 text-etiqueta-md leading-[22px] text-sobre-primario">
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
        <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-primario bg-primario-fijo/40 p-3">
          <input autoFocus value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué es" className={`${CAMPO_CHICO} min-w-40 flex-1 bg-tarjeta`} />
          <input value={precio} onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio" inputMode="numeric"
            className={`${CAMPO_CHICO} w-28 bg-tarjeta`} />
          <button type="button" onClick={agregarLibre} className={`${BOTON_PRIMARIO} py-1.5`}>
            Agregar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAbriendoLibre(true)}
          className="w-full rounded-lg border border-dashed border-borde-suave py-3 text-etiqueta-lg text-primario transition-colors hover:border-primario hover:bg-primario-fijo/40">
          ＋ Ítem libre
        </button>
      )}

      <p className="mt-3 text-etiqueta-md text-tinta-suave">
        Clic para sumar · clic derecho para restar
      </p>
    </div>
  )
}
