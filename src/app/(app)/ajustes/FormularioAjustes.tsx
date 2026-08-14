'use client'

import { useState } from 'react'
import { guardarAjustes } from '@/lib/db/ajustes'
import type { Ajustes } from '@/lib/db/ajustes'

const CAMPOS: { clave: keyof Ajustes; etiqueta: string; ayuda?: string }[] = [
  { clave: 'nombreNegocio', etiqueta: 'Nombre del negocio' },
  { clave: 'eslogan', etiqueta: 'Eslogan', ayuda: 'Ej.: Helado Artesanal' },
  { clave: 'logoUrl', etiqueta: 'URL del logo', ayuda: 'Opcional' },
  { clave: 'telefonos', etiqueta: 'Teléfonos de pedidos', ayuda: 'Salen en el recibo' },
  { clave: 'datosPago', etiqueta: 'Datos de pago', ayuda: 'Nequi, cuenta bancaria' },
  { clave: 'prefijoConsecutivo', etiqueta: 'Prefijo del consecutivo', ayuda: 'Ej.: PED → PED-000148' },
  { clave: 'pieRecibo', etiqueta: 'Texto al pie del recibo' },
]

const NUMERICOS: { clave: keyof Ajustes; etiqueta: string }[] = [
  { clave: 'valorDomicilioDefault', etiqueta: 'Valor del domicilio por defecto' },
  { clave: 'etiquetaAnchoMm', etiqueta: 'Ancho de la etiqueta (mm)' },
  { clave: 'etiquetaAltoMm', etiqueta: 'Alto de la etiqueta (mm)' },
]

export function FormularioAjustes({ iniciales }: { iniciales: Ajustes }) {
  const [ajustes, setAjustes] = useState(iniciales)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    try {
      await guardarAjustes(ajustes)
      setMensaje('Guardado')
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mx-auto max-w-lg space-y-3 p-4">
      <h1 className="text-lg font-bold">Ajustes del negocio</h1>

      {CAMPOS.map(({ clave, etiqueta, ayuda }) => (
        <label key={clave} className="block">
          <span className="text-sm font-semibold">{etiqueta}</span>
          {ayuda && <span className="ml-2 text-xs text-slate-500">{ayuda}</span>}
          <input
            value={(ajustes[clave] as string) ?? ''}
            onChange={(e) => setAjustes({ ...ajustes, [clave]: e.target.value })}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      ))}

      {NUMERICOS.map(({ clave, etiqueta }) => (
        <label key={clave} className="block">
          <span className="text-sm font-semibold">{etiqueta}</span>
          <input
            inputMode="numeric" value={ajustes[clave] as number}
            onChange={(e) =>
              setAjustes({ ...ajustes, [clave]: Number(e.target.value.replace(/\D/g, '')) || 0 })
            }
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
      ))}

      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      <button type="submit" disabled={guardando}
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
