import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos } from '@/lib/dinero'

export function RotuloLocal({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const cobrar = pedido.estadoPago === 'contraentrega'

  return (
    <div
      className="hoja-rotulo"
      style={{ width: `${ajustes.etiquetaAnchoMm}mm`, height: `${ajustes.etiquetaAltoMm}mm` }}
    >
      <div className="flex items-center justify-between border-b-2 border-black pb-1 text-[10px] tracking-wide">
        <span className="font-extrabold">{ajustes.nombreNegocio}</span>
        <span className="font-mono">{pedido.consecutivo}</span>
      </div>

      <div className="mt-3 text-[9px] font-bold tracking-[0.13em]">ENTREGAR A</div>
      <div className="mt-0.5 text-[20px] font-extrabold uppercase leading-tight">
        {pedido.clienteNombre}
      </div>

      <div className="mt-2 text-[14px] font-semibold leading-snug">{pedido.dirLinea}</div>
      {pedido.dirBarrio && (
        <div className="mt-1 text-[15px] font-extrabold uppercase">{pedido.dirBarrio}</div>
      )}
      <div className="text-[12px]">{pedido.dirCiudad}</div>

      <div className="mt-2.5 text-[17px] font-extrabold">📞 {pedido.clienteTelefono}</div>

      {pedido.dirIndicaciones && (
        <div className="mt-2 text-[10.5px] italic leading-snug">
          &ldquo;{pedido.dirIndicaciones}&rdquo;
        </div>
      )}

      <div className="flex-1" />

      {cobrar && (
        <div className="mt-2 border-[3px] border-black p-2 text-center">
          <div className="text-[10px] font-extrabold tracking-[0.1em]">COBRAR CONTRAENTREGA</div>
          <div className="mt-0.5 text-[27px] font-extrabold leading-tight">
            {formatearPesos(pedido.total)}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-black pt-1.5">
        <span className="font-mono text-[11px] font-bold">{pedido.clienteCodigo}</span>
        <span className="border-[1.5px] border-black px-1.5 py-0.5 text-[10px] font-extrabold">
          ❄ CONGELADO
        </span>
      </div>
    </div>
  )
}
