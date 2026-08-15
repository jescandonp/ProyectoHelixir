'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Recibo } from '@/components/documentos/Recibo'
import { RotuloLocal } from '@/components/documentos/RotuloLocal'
import { RotuloNacional } from '@/components/documentos/RotuloNacional'
import { descargarComoPng } from '@/lib/documentos/a-png'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, BOTON_EXITO } from '@/components/estilos'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

type Pestana = 'recibo' | 'rotulo'

export function VistaDocumentos({
  pedido, ajustes,
}: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const [pestana, setPestana] = useState<Pestana>('recibo')
  const referencia = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)

  /** `@page` no acepta selectores, así que la regla de tamaño se inyecta
   *  y se reemplaza justo antes de abrir el diálogo de impresión. */
  function imprimir() {
    const tamano = pestana === 'recibo'
      ? '80mm auto'
      : `${ajustes.etiquetaAnchoMm}mm ${ajustes.etiquetaAltoMm}mm`

    let estilo = document.getElementById('regla-pagina') as HTMLStyleElement | null
    if (!estilo) {
      estilo = document.createElement('style')
      estilo.id = 'regla-pagina'
      document.head.appendChild(estilo)
    }
    estilo.textContent = `@page { size: ${tamano}; margin: 0 }`

    window.print()
  }

  async function descargar() {
    if (!referencia.current) return
    setGenerando(true)
    try {
      await descargarComoPng(
        referencia.current,
        `${pedido.consecutivo}-${pestana}`,
      )
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10">
      <div className="solo-pantalla mb-6 flex flex-wrap items-center gap-3">
        <Link href="/pedidos/nuevo" className={BOTON_SECUNDARIO}>
          ← Nuevo pedido
        </Link>

        <div className="inline-flex rounded-full bg-tarjeta-media p-1">
          {(['recibo', 'rotulo'] as Pestana[]).map((clave) => (
            <button
              key={clave} type="button" onClick={() => setPestana(clave)}
              aria-pressed={pestana === clave}
              className={`rounded-full px-4 py-1.5 text-etiqueta-lg transition-colors ${
                pestana === clave
                  ? 'bg-primario text-sobre-primario'
                  : 'text-tinta-tenue hover:text-primario'
              }`}
            >
              {clave === 'recibo'
                ? 'Recibo'
                : `Rótulo ${pedido.tipoEntrega === 'local' ? 'local' : 'nacional'}`}
            </button>
          ))}
        </div>

        <button type="button" onClick={imprimir} className={BOTON_PRIMARIO}>
          🖨 Imprimir
        </button>
        <button type="button" onClick={descargar} disabled={generando} className={BOTON_EXITO}>
          {generando ? 'Generando…' : '⬇ Imagen para WhatsApp'}
        </button>
      </div>

      <div className="flex justify-center">
        {/* La sombra va en este envoltorio y no en la hoja: `html-to-image`
            captura este nodo para la imagen de WhatsApp, y la hoja tiene que
            seguir siendo blanco puro para la impresora térmica. */}
        <div ref={referencia} className="shadow-nivel2">
          {pestana === 'recibo' ? (
            <Recibo pedido={pedido} ajustes={ajustes} />
          ) : pedido.tipoEntrega === 'local' ? (
            <RotuloLocal pedido={pedido} ajustes={ajustes} />
          ) : (
            <RotuloNacional pedido={pedido} ajustes={ajustes} />
          )}
        </div>
      </div>
    </div>
  )
}
