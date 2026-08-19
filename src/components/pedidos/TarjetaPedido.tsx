import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'
import { AccionesPedido } from '@/components/pedidos/AccionesPedido'
import { CHIP_PAGO } from '@/components/estilos'
import type { FilaPedido as Datos } from '@/lib/db/pedidos-consultas'

/** La versión de celular de una fila de pedidos: lo mismo que muestra la
 *  tabla, apilado. Lo que primero se busca con el pulgar —cuánto es y si
 *  está pagado— queda arriba y grande. */
export function TarjetaPedido({ pedido }: { pedido: Datos }) {
  return (
    <li className="border-b border-borde-suave/60 p-4 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="block font-mono text-etiqueta-md text-tinta-suave">
            {pedido.consecutivo}
          </span>
          <span className="block text-cuerpo-md text-tinta">{pedido.clienteNombre}</span>
          <span className="block text-etiqueta-md text-tinta-suave">
            {pedido.dirCiudad} · {formatearFechaCo(pedido.fecha)}
          </span>
        </div>
        <div className="text-right">
          <span className="block font-titulo text-cuerpo-lg tabular-nums text-tinta">
            {formatearPesos(pedido.total)}
          </span>
          <span className="block text-etiqueta-md tabular-nums text-tinta-tenue">
            {pedido.totalKg} kg
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-etiqueta-md text-tinta-suave">{pedido.estado}</span>
        <span className={CHIP_PAGO[pedido.estadoPago]}>{pedido.estadoPago}</span>
      </div>

      <AccionesPedido pedido={pedido} />
    </li>
  )
}
