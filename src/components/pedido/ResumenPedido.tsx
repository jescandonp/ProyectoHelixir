'use client'

import type { ItemPedido, Totales, TipoEntrega, EstadoPago } from '@/lib/tipos'
import { formatearPesos, formatearPesosSinSimbolo } from '@/lib/dinero'
import { calcularSubtotalItem } from '@/lib/pedidos/calculos'
import { TARJETA, ETIQUETA_SECCION, CAMPO, BOTON_PRIMARIO, AVISO_ERROR } from '@/components/estilos'
import { IconoBolsa, IconoTienda, IconoCamion } from '@/components/iconos'

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

const ENTREGAS: { tipo: TipoEntrega; texto: string; Icono: typeof IconoTienda }[] = [
  { tipo: 'local', texto: 'Local', Icono: IconoTienda },
  { tipo: 'nacional', texto: 'Nacional', Icono: IconoCamion },
]

const PAGOS: { estado: EstadoPago; texto: string }[] = [
  { estado: 'pendiente', texto: 'Pendiente' },
  { estado: 'contraentrega', texto: 'Contraent.' },
  { estado: 'pagado', texto: 'Pagado' },
]

/** Un grupo de opciones excluyentes, del tamaño de un dedo. Lo usan tanto la
 *  entrega como el estado de pago para que las dos filas se lean igual. */
function Segmentado<T extends string>({
  opciones, valor, onCambiar,
}: {
  opciones: { valor: T; texto: string; Icono?: typeof IconoTienda }[]
  valor: T
  onCambiar: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {opciones.map(({ valor: v, texto, Icono }) => (
        <button
          key={v} type="button" onClick={() => onCambiar(v)}
          aria-pressed={valor === v}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border-2 py-2 text-etiqueta-md transition-colors ${
            valor === v
              ? 'border-primario bg-primario text-sobre-primario'
              : 'border-borde-suave bg-tarjeta text-tinta-tenue hover:border-primario'
          }`}
        >
          {Icono && <Icono className="h-4 w-4 shrink-0" />}
          {texto}
        </button>
      ))}
    </div>
  )
}

export function ResumenPedido(p: Props) {
  const bloqueado = p.problemas.length > 0 || p.confirmando

  return (
    <div className={`${TARJETA} overflow-hidden`}>
      <p className={`border-b border-borde-suave bg-tarjeta-baja px-4 py-3 ${ETIQUETA_SECCION}`}>
        El pedido
      </p>

      <div className="px-4 py-3">
        {p.items.length === 0 && (
          <div className="py-8 text-center">
            <IconoBolsa className="mx-auto mb-2 h-8 w-8 text-borde-suave" />
            <p className="text-cuerpo-md text-tinta-tenue">Sin productos</p>
          </div>
        )}

        {p.items.map((item, i) => (
          <div key={i} className="flex justify-between py-1.5 text-cuerpo-md text-tinta">
            <span>
              <strong className="text-primario">{item.cantidad}</strong> × {item.descripcion}
            </span>
            <span className="tabular-nums">
              {formatearPesosSinSimbolo(calcularSubtotalItem(item))}
            </span>
          </div>
        ))}

        {/* Línea punteada, como el troquel de un recibo de verdad. */}
        <div className="my-2 border-t border-dashed border-borde-suave" />

        <div className="flex justify-between text-cuerpo-md text-tinta-tenue">
          <span>Subtotal · {p.totales.totalKg} kg</span>
          <span className="tabular-nums">{formatearPesosSinSimbolo(p.totales.subtotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-cuerpo-md text-tinta-tenue">
          <label htmlFor="domicilio">Domicilio</label>
          <input
            id="domicilio" value={p.valorDomicilio || ''} inputMode="numeric"
            onChange={(e) => p.onCambiarDomicilio(Number(e.target.value.replace(/\D/g, '')) || 0)}
            className="w-28 rounded-md border border-borde-suave bg-tarjeta-baja px-2 py-1 text-right text-cuerpo-md tabular-nums text-tinta outline-none transition-colors focus:border-primario"
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t-2 border-tinta pt-3">
          <span className="font-titulo text-titulo-md text-tinta">TOTAL</span>
          <span className="font-titulo text-titulo-md tabular-nums text-tinta">
            {formatearPesos(p.totales.total)}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        <div>
          <p className={`mb-2 ${ETIQUETA_SECCION}`}>Entrega</p>
          <Segmentado
            opciones={ENTREGAS.map(({ tipo, texto, Icono }) => ({ valor: tipo, texto, Icono }))}
            valor={p.tipoEntrega} onCambiar={p.onCambiarEntrega}
          />
          {p.tipoEntrega === 'nacional' && (
            <input
              value={p.transportadora} onChange={(e) => p.onCambiarTransportadora(e.target.value)}
              placeholder="Transportadora" className={`${CAMPO} mt-2`}
            />
          )}
        </div>

        <div>
          <p className={`mb-2 ${ETIQUETA_SECCION}`}>Pago</p>
          <Segmentado
            opciones={PAGOS.map(({ estado, texto }) => ({ valor: estado, texto }))}
            valor={p.estadoPago} onCambiar={p.onCambiarPago}
          />
        </div>

        <textarea
          value={p.observaciones} onChange={(e) => p.onCambiarObservaciones(e.target.value)}
          placeholder="Observaciones…" rows={2} aria-label="Observaciones"
          className={CAMPO}
        />

        {p.problemas.length > 0 && (
          <ul className={AVISO_ERROR}>
            {p.problemas.map((problema) => <li key={problema}>· {problema}</li>)}
          </ul>
        )}

        <button
          type="button" onClick={p.onConfirmar} disabled={bloqueado}
          className={`${BOTON_PRIMARIO} w-full py-3`}
        >
          {p.confirmando ? 'Generando…' : 'Generar recibo + rótulo'}
        </button>
      </div>
    </div>
  )
}
