'use client'

import type { ItemPedido, Totales, TipoEntrega, EstadoPago } from '@/lib/tipos'
import { formatearPesos, formatearPesosSinSimbolo } from '@/lib/dinero'
import { calcularSubtotalItem } from '@/lib/pedidos/calculos'

interface Props {
  items: ItemPedido[]
  totales: Totales
  valorDomicilio: number
  tipoEntrega: TipoEntrega
  transportadora: string
  estadoPago: EstadoPago
  observaciones: string
  problemas: string[]
  confirmando: boolean
  onCambiarDomicilio: (valor: number) => void
  onCambiarEntrega: (tipo: TipoEntrega) => void
  onCambiarTransportadora: (nombre: string) => void
  onCambiarPago: (estado: EstadoPago) => void
  onCambiarObservaciones: (texto: string) => void
  onConfirmar: () => void
}

export function ResumenPedido(p: Props) {
  const bloqueado = p.problemas.length > 0 || p.confirmando

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <p className="border-b bg-slate-50 px-3 py-2 text-[10px] font-bold tracking-wider text-slate-500">
        EL PEDIDO
      </p>

      <div className="px-3 py-2 text-sm">
        {p.items.length === 0 && <p className="py-3 text-center text-slate-400">Sin productos</p>}

        {p.items.map((item, i) => (
          <div key={i} className="flex justify-between border-b border-slate-50 py-1">
            <span><strong>{item.cantidad}</strong> × {item.descripcion}</span>
            <span className="tabular-nums">{formatearPesosSinSimbolo(calcularSubtotalItem(item))}</span>
          </div>
        ))}

        <div className="flex justify-between pt-2 text-slate-500">
          <span>Subtotal · {p.totales.totalKg} kg</span>
          <span className="tabular-nums">{formatearPesosSinSimbolo(p.totales.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Domicilio</span>
          <input
            value={p.valorDomicilio || ''} inputMode="numeric"
            onChange={(e) => p.onCambiarDomicilio(Number(e.target.value.replace(/\D/g, '')) || 0)}
            className="w-24 rounded border px-2 py-0.5 text-right text-sm tabular-nums"
          />
        </div>
        <div className="mt-1 flex justify-between border-t-2 border-slate-900 pt-2 text-lg font-extrabold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatearPesos(p.totales.total)}</span>
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3">
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-400">ENTREGA</p>
          <div className="flex gap-1.5">
            {(['local', 'nacional'] as TipoEntrega[]).map((tipo) => (
              <button key={tipo} type="button" onClick={() => p.onCambiarEntrega(tipo)}
                className={`flex-1 rounded-md py-1.5 text-xs ${
                  p.tipoEntrega === tipo
                    ? 'border-2 border-slate-900 bg-slate-900 font-semibold text-white'
                    : 'border border-slate-200 text-slate-700'
                }`}>
                {tipo === 'local' ? '🛵 Local' : '📦 Nacional'}
              </button>
            ))}
          </div>
          {p.tipoEntrega === 'nacional' && (
            <input value={p.transportadora} onChange={(e) => p.onCambiarTransportadora(e.target.value)}
              placeholder="Transportadora" className="mt-1.5 w-full rounded border px-2 py-1 text-sm" />
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-400">PAGO</p>
          <div className="flex gap-1.5">
            {(['pendiente', 'contraentrega', 'pagado'] as EstadoPago[]).map((estado) => (
              <button key={estado} type="button" onClick={() => p.onCambiarPago(estado)}
                className={`flex-1 rounded-md py-1.5 text-[11px] ${
                  p.estadoPago === estado
                    ? 'border-2 border-amber-600 bg-amber-50 font-semibold text-amber-700'
                    : 'border border-slate-200 text-slate-700'
                }`}>
                {estado === 'contraentrega' ? 'Contraent.' : estado === 'pagado' ? 'Pagado' : 'Pendiente'}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={p.observaciones} onChange={(e) => p.onCambiarObservaciones(e.target.value)}
          placeholder="Observaciones…" rows={2}
          className="w-full rounded border px-2 py-1 text-sm"
        />

        {p.problemas.length > 0 && (
          <ul className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {p.problemas.map((problema) => <li key={problema}>· {problema}</li>)}
          </ul>
        )}

        <button
          type="button" onClick={p.onConfirmar} disabled={bloqueado}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-bold text-white disabled:bg-slate-300"
        >
          {p.confirmando ? 'Generando…' : 'Generar recibo + rótulo'}
        </button>
      </div>
    </div>
  )
}
