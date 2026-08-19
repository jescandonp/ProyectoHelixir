'use client'

import { useState } from 'react'
import { guardarAjustes } from '@/lib/db/ajustes'
import type { Ajustes } from '@/lib/db/ajustes'
import {
  TARJETA, CAMPO, ETIQUETA, BOTON_PRIMARIO, BOTON_SECUNDARIO, AVISO_ERROR, AVISO_EXITO,
} from '@/components/estilos'

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
  const [fallo, setFallo] = useState(false)

  // "Descartar" solo vuelve a los valores con los que cargó la pantalla: no
  // toca la base ni recarga. Por eso se apaga cuando no hay nada que
  // descartar, para no ofrecer un botón que no haría nada.
  const hayCambios = JSON.stringify(ajustes) !== JSON.stringify(iniciales)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setFallo(false)
    try {
      await guardarAjustes(ajustes)
      setMensaje('Guardado')
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo guardar')
      setFallo(true)
    } finally {
      setGuardando(false)
    }
  }

  function cambiar(clave: keyof Ajustes, valor: string | number) {
    setAjustes({ ...ajustes, [clave]: valor })
    setMensaje(null)
  }

  return (
    <form onSubmit={enviar} className="mx-auto max-w-2xl px-4 py-6 md:px-10">
      <h1 className="font-titulo text-titulo-lg-mobile text-tinta md:text-titulo-lg">
        Ajustes del negocio
      </h1>
      <p className="mb-6 mt-1 text-cuerpo-md text-tinta-tenue">
        El perfil del negocio y lo que sale impreso en recibos y rótulos.
      </p>

      <div className={`${TARJETA} space-y-5 p-6`}>
        {CAMPOS.map(({ clave, etiqueta, ayuda }) => (
          <label key={clave} className="block">
            <span className={ETIQUETA}>
              {etiqueta}
              {ayuda && <span className="ml-2 font-normal tracking-normal text-tinta-tenue">{ayuda}</span>}
            </span>
            <input
              value={(ajustes[clave] as string) ?? ''}
              onChange={(e) => cambiar(clave, e.target.value)}
              className={CAMPO}
            />
          </label>
        ))}

        {NUMERICOS.map(({ clave, etiqueta }) => (
          <label key={clave} className="block">
            <span className={ETIQUETA}>{etiqueta}</span>
            <input
              inputMode="numeric" value={ajustes[clave] as number}
              onChange={(e) => cambiar(clave, Number(e.target.value.replace(/\D/g, '')) || 0)}
              className={`${CAMPO} tabular-nums`}
            />
          </label>
        ))}

        {mensaje && <p className={fallo ? AVISO_ERROR : AVISO_EXITO}>{mensaje}</p>}

        <div className="flex justify-end gap-3 border-t border-borde-suave pt-5">
          <button
            type="button" disabled={!hayCambios || guardando}
            onClick={() => { setAjustes(iniciales); setMensaje(null); setFallo(false) }}
            className={BOTON_SECUNDARIO}
          >
            Descartar
          </button>
          <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}
