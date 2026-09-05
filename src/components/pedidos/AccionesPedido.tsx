'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { accionesDisponibles } from '@/lib/pedidos/acciones'
import { marcarPagado, marcarEnviado, marcarEntregado, anularPedido } from '@/lib/db/pedidos'
import {
  BOTON_SECUNDARIO, BOTON_EXITO, BOTON_PELIGRO, CAMPO_CHICO, AVISO_ERROR,
} from '@/components/estilos'
import type { FilaPedido as Datos } from '@/lib/db/pedidos-consultas'

const METODOS = ['Nequi', 'Efectivo', 'Transferencia']

/* Los mismos botones sirven a la tabla del escritorio y a la tarjeta del
   celular, así que el estado de la fila (método de pago, anulación en curso,
   error) vive aquí una sola vez. Las dos presentaciones solo cambian dónde
   se pintan, nunca qué hacen. */

export function AccionesPedido({ pedido }: { pedido: Datos }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [metodo, setMetodo] = useState('')

  const acciones = accionesDisponibles(pedido.estado, pedido.estadoPago)

  function ejecutar(accion: () => Promise<void>) {
    setError(null)
    iniciar(async () => {
      try {
        await accion()
        router.refresh()
      } catch (e) {
        // El error sale en la fila: el listado no se pierde y se reintenta.
        setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
        // Cuando la acción falla porque otra sesión ya cambió el pedido,
        // la fila queda mostrando el estado viejo. `router.refresh()` la
        // trae al día sola, sin obligar al usuario a recargar a mano en
        // la pantalla del dinero. El mensaje de error vive en estado
        // local (`setError` arriba), así que sobrevive al refresh.
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {acciones.puedeVerDocumentos && (
          <Link href={`/pedidos/${pedido.id}/documentos`} className={BOTON_SECUNDARIO}>
            Documentos
          </Link>
        )}
        {acciones.puedeCobrar && (
          <>
            <select
              value={metodo} onChange={(e) => setMetodo(e.target.value)}
              aria-label="Método de pago"
              className={CAMPO_CHICO}
            >
              <option value="">Método…</option>
              {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button
              type="button" disabled={pendiente}
              onClick={() => ejecutar(() => marcarPagado(pedido.id, metodo))}
              className={BOTON_EXITO}
            >
              Pagado
            </button>
          </>
        )}
        {acciones.puedeEnviar && (
          <button type="button" disabled={pendiente}
            onClick={() => ejecutar(() => marcarEnviado(pedido.id))}
            className={BOTON_SECUNDARIO}>
            Enviado
          </button>
        )}
        {acciones.puedeEntregar && (
          <button type="button" disabled={pendiente}
            onClick={() => ejecutar(() => marcarEntregado(pedido.id))}
            className={BOTON_SECUNDARIO}>
            Entregado
          </button>
        )}
        {acciones.puedeAnular && (
          <button type="button" onClick={() => setAnulando(true)} className={BOTON_PELIGRO}>
            Anular
          </button>
        )}
      </div>

      {anulando && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-error-contenedor p-2">
          <input
            autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la anulación"
            className={`${CAMPO_CHICO} min-w-40 flex-1 bg-tarjeta`}
          />
          <button
            type="button" disabled={pendiente || !motivo.trim()}
            onClick={() => { ejecutar(() => anularPedido(pedido.id, motivo)); setAnulando(false) }}
            className="inline-flex items-center rounded-md bg-error px-3 py-1.5 text-etiqueta-md text-sobre-error transition-colors hover:bg-sobre-error-contenedor disabled:opacity-50"
          >
            Anular
          </button>
          <button type="button" onClick={() => setAnulando(false)} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
        </div>
      )}

      {error && <p className={AVISO_ERROR}>{error}</p>}
    </div>
  )
}
