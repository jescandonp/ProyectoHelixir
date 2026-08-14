import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos } from '@/lib/dinero'
import { valorEnLetras } from '@/lib/numero-a-letras'

/** La cédula se muestra parcial: es el recibo del propio cliente,
 *  pero el papel puede quedar a la vista de terceros. */
function enmascararCedula(cedula: string | null): string {
  if (!cedula) return '—'
  const limpia = cedula.replace(/\D/g, '')
  if (limpia.length <= 4) return limpia
  return `${limpia.slice(0, 4)}${'x'.repeat(limpia.length - 4)}`
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function Recibo({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const pagado = pedido.estadoPago === 'pagado'

  return (
    <div className="hoja-recibo text-[14px] leading-[1.34]">
      <div className="text-center">
        {ajustes.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ajustes.logoUrl} alt="" className="mx-auto mb-1 h-14 object-contain" />
        )}
        <div className="text-[22px] font-black leading-tight">{ajustes.nombreNegocio}</div>
        <div className="mx-auto my-1 w-[72%] border-t-[3px] border-black" />
        <div className="text-[15px] font-extrabold">{ajustes.eslogan}</div>
        <div className="text-[12.5px]">PEDIDOS : {ajustes.telefonos}</div>
      </div>

      <div className="my-2 text-center text-[18px] font-black tracking-wider">
        ORDEN No. {pedido.consecutivo}
      </div>

      <div className="grid grid-cols-[74px_1fr] gap-y-0.5 text-[13.5px] leading-tight">
        <div className="font-extrabold">Cliente:</div><div>{pedido.clienteNombre}</div>
        <div className="font-extrabold">Fecha:</div><div>{formatearFecha(pedido.fecha)}</div>
        <div className="font-extrabold">Cédula:</div><div>{enmascararCedula(pedido.clienteCedula)}</div>
        <div className="font-extrabold">Teléfono:</div><div>{pedido.clienteTelefono ?? '—'}</div>
        <div className="font-extrabold">Asesor:</div><div>{pedido.asesorCodigo ?? '—'}</div>
        <div className="font-extrabold">Envío:</div>
        <div>
          {pedido.tipoEntrega === 'local'
            ? 'Local · domicilio propio'
            : `Nacional · ${pedido.transportadora ?? ''}`}
        </div>
        <div className="font-extrabold">Dirección:</div>
        <div>
          {pedido.dirLinea}
          <br />
          {[pedido.dirBarrio, pedido.dirCiudad].filter(Boolean).join(' · ')}
        </div>
      </div>

      <div className="my-2 bg-black py-0.5 text-center text-[14.5px] font-extrabold text-white">
        Detalle del Pedido
      </div>

      <div className="mb-1.5 text-[13.5px]">
        {pedido.totalKg} Kg · Helado Artesanal en tarro
      </div>

      <div className="text-[14.5px] leading-[1.5]">
        {pedido.items.map((item, i) => (
          <div key={i}>
            <div className="flex items-baseline">
              <span>{item.cantidad} {item.descripcion}</span>
              <span className="mx-1 mb-1 flex-1 border-b-2 border-dotted border-black" />
              <span className="tabular-nums">{formatearPesos(item.subtotal)}</span>
            </div>
            {item.cantidad > 1 && (
              <div className="-mt-1 pl-3 text-[11px]">
                {item.cantidad} kg × {formatearPesos(item.precioUnitario)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="my-2 border-t-2 border-dashed border-black" />

      <div className="text-right text-[14.5px] leading-[1.5]">
        <div>
          <strong>Subtotal:</strong>{' '}
          <span className="inline-block w-20 text-right tabular-nums">
            {formatearPesos(pedido.subtotal)}
          </span>
        </div>
        <div>
          <strong>Valor Domicilio:</strong>{' '}
          <span className="inline-block w-20 text-right tabular-nums">
            {formatearPesos(pedido.valorDomicilio)}
          </span>
        </div>
      </div>

      <div className="my-2 flex justify-between bg-black px-2 py-1 text-[17px] font-black text-white">
        <span>TOTAL:</span>
        <span className="tabular-nums">{formatearPesos(pedido.total)}</span>
      </div>

      <div className="text-[13.5px] leading-tight">
        <div><strong>Valor Total en Letras:</strong></div>
        <div>{valorEnLetras(pedido.total)}</div>
        {pedido.observaciones && (
          <>
            <div className="mt-1"><strong>Observaciones:</strong></div>
            <div>{pedido.observaciones}</div>
          </>
        )}
      </div>

      <div className="mt-2 border-2 border-black px-2 py-1 text-center text-[13px] leading-tight">
        {pagado ? (
          <>
            <strong className="text-[13.5px] tracking-wide">PAGADO ✓</strong>
            {pedido.fechaPago && <div>{formatearFecha(pedido.fechaPago)}</div>}
          </>
        ) : (
          <>
            <strong className="text-[13.5px] tracking-wide">PENDIENTE DE PAGO</strong>
            <div>{ajustes.datosPago}</div>
          </>
        )}
      </div>

      <div className="my-2 border-t-2 border-dashed border-black" />
      <div className="text-center text-[12px] leading-tight">
        <strong>❄ CONSERVAR EN FRÍO</strong>
        <br />
        {ajustes.pieRecibo}
      </div>
    </div>
  )
}
