'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Recibo } from '@/components/documentos/Recibo'
import { RotuloLocal } from '@/components/documentos/RotuloLocal'
import { RotuloNacional } from '@/components/documentos/RotuloNacional'
import { descargarComoPng } from '@/lib/documentos/a-png'
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
    <div className="mx-auto max-w-3xl p-4">
      <div className="solo-pantalla mb-4 flex flex-wrap items-center gap-2">
        <Link href="/pedidos/nuevo" className="rounded-lg border bg-white px-3 py-2 text-sm">
          ← Nuevo pedido
        </Link>

        <div className="flex overflow-hidden rounded-lg border bg-white">
          <button
            onClick={() => setPestana('recibo')}
            className={`px-4 py-2 text-sm ${pestana === 'recibo' ? 'bg-slate-900 font-semibold text-white' : ''}`}
          >
            Recibo
          </button>
          <button
            onClick={() => setPestana('rotulo')}
            className={`px-4 py-2 text-sm ${pestana === 'rotulo' ? 'bg-slate-900 font-semibold text-white' : ''}`}
          >
            Rótulo {pedido.tipoEntrega === 'local' ? 'local' : 'nacional'}
          </button>
        </div>

        <button onClick={imprimir}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          🖨 Imprimir
        </button>
        <button onClick={descargar} disabled={generando}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {generando ? 'Generando…' : '⬇ Imagen para WhatsApp'}
        </button>
      </div>

      <div className="flex justify-center">
        <div ref={referencia} className="shadow-lg">
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
