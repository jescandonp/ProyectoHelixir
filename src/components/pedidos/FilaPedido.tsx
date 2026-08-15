'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'
import { accionesDisponibles } from '@/lib/pedidos/acciones'
import { marcarPagado, marcarEnviado, marcarEntregado, anularPedido } from '@/lib/db/pedidos'
import type { FilaPedido as Datos } from '@/lib/db/pedidos-consultas'

const METODOS = ['Nequi', 'Efectivo', 'Transferencia']

export function FilaPedido({ pedido }: { pedido: Datos }) {
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
    <>
      <tr className="border-b text-sm">
        <td className="px-2 py-2 font-mono text-xs">{pedido.consecutivo}</td>
        <td className="px-2 py-2 text-xs text-slate-500">{formatearFechaCo(pedido.fecha)}</td>
        <td className="px-2 py-2">
          {pedido.clienteNombre}
          <span className="block text-xs text-slate-500">{pedido.dirCiudad}</span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{pedido.totalKg} kg</td>
        <td className="px-2 py-2 text-right tabular-nums font-semibold">
          {formatearPesos(pedido.total)}
        </td>
        <td className="px-2 py-2 text-xs">
          {pedido.estado}
          <span className={`ml-1 rounded px-1.5 py-0.5 ${
            pedido.estadoPago === 'pagado'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {pedido.estadoPago}
          </span>
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {acciones.puedeVerDocumentos && (
              <Link href={`/pedidos/${pedido.id}/documentos`}
                className="rounded border px-2 py-1 text-xs">Documentos</Link>
            )}
            {acciones.puedeCobrar && (
              <>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
                  className="rounded border px-1 py-1 text-xs">
                  <option value="">Método…</option>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" disabled={pendiente}
                  onClick={() => ejecutar(() => marcarPagado(pedido.id, metodo))}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                  Pagado
                </button>
              </>
            )}
            {acciones.puedeEnviar && (
              <button type="button" disabled={pendiente}
                onClick={() => ejecutar(() => marcarEnviado(pedido.id))}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50">Enviado</button>
            )}
            {acciones.puedeEntregar && (
              <button type="button" disabled={pendiente}
                onClick={() => ejecutar(() => marcarEntregado(pedido.id))}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50">Entregado</button>
            )}
            {acciones.puedeAnular && (
              <button type="button" onClick={() => setAnulando(true)}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Anular</button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>

      {anulando && (
        <tr>
          <td colSpan={7} className="bg-red-50 px-2 py-2">
            <div className="flex items-center gap-2">
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la anulación"
                className="flex-1 rounded border px-2 py-1 text-sm" />
              <button type="button" disabled={pendiente || !motivo.trim()}
                onClick={() => { ejecutar(() => anularPedido(pedido.id, motivo)); setAnulando(false) }}
                className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
                Anular
              </button>
              <button type="button" onClick={() => setAnulando(false)}
                className="rounded border px-3 py-1 text-sm">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
