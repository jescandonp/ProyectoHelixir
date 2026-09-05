import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'
import { AccionesPedido } from '@/components/pedidos/AccionesPedido'
import { CHIP_PAGO } from '@/components/estilos'
import type { FilaPedido as Datos } from '@/lib/db/pedidos-consultas'

/** La fila de la tabla del escritorio. En el celular la misma información
 *  se pinta con `TarjetaPedido`, porque siete columnas no caben en 375px. */
export function FilaPedido({ pedido }: { pedido: Datos }) {
  return (
    <tr className="border-b border-borde-suave/60 last:border-0 align-top transition-colors hover:bg-tarjeta-baja">
      {/* `whitespace-nowrap` en consecutivo, fecha, kilos y total: son datos
          cortos que se leen de un vistazo, y si el navegador los parte en dos
          renglones para dejarle sitio a las acciones, la columna del dinero
          termina mostrando el "$" encima de la cifra. */}
      <td className="whitespace-nowrap px-3 py-4 font-mono text-etiqueta-md text-tinta-suave">
        {pedido.consecutivo}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-etiqueta-md text-tinta-tenue">
        {formatearFechaCo(pedido.fecha)}
      </td>
      <td className="min-w-40 px-3 py-4">
        <span className="block text-cuerpo-md text-tinta">{pedido.clienteNombre}</span>
        <span className="block text-etiqueta-md text-tinta-suave">{pedido.dirCiudad}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums text-cuerpo-md text-tinta">
        {pedido.totalKg} kg
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-right font-titulo tabular-nums text-cuerpo-md text-tinta">
        {formatearPesos(pedido.total)}
      </td>
      <td className="whitespace-nowrap px-3 py-4">
        <span className="block text-etiqueta-md text-tinta-suave">{pedido.estado}</span>
        <span className={`mt-1 ${CHIP_PAGO[pedido.estadoPago]}`}>{pedido.estadoPago}</span>
      </td>
      <td className="min-w-72 px-3 py-4">
        <AccionesPedido pedido={pedido} />
      </td>
    </tr>
  )
}
