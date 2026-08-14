import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'

export function RotuloNacional({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  return (
    <div
      className="hoja-rotulo"
      style={{ width: `${ajustes.etiquetaAnchoMm}mm`, height: `${ajustes.etiquetaAltoMm}mm` }}
    >
      <div className="flex items-center justify-between border-b-2 border-black pb-1 text-[10px] tracking-wide">
        <span className="font-extrabold">{ajustes.nombreNegocio}</span>
        <span className="font-mono">{pedido.consecutivo}</span>
      </div>

      <div className="mt-3 text-[9px] font-bold tracking-[0.13em]">DESTINATARIO</div>
      <div className="mt-0.5 text-[19px] font-extrabold uppercase leading-tight">
        {pedido.clienteNombre}
      </div>

      <div className="mt-2 text-[13.5px] font-semibold leading-snug">
        {pedido.dirLinea}
        {pedido.dirBarrio && <><br />{pedido.dirBarrio}</>}
      </div>

      <div className="mt-2 bg-black px-2 py-1.5 text-white">
        <div className="text-[8.5px] tracking-[0.12em] opacity-85">CIUDAD DESTINO</div>
        <div className="text-[21px] font-extrabold uppercase leading-tight">{pedido.dirCiudad}</div>
        {pedido.dirDepartamento && <div className="text-[11px]">{pedido.dirDepartamento}</div>}
      </div>

      <div className="mt-2.5 text-[16px] font-extrabold">📞 {pedido.clienteTelefono}</div>

      <div className="flex-1" />

      <div className="mt-2 border-[3px] border-black p-1.5 text-center">
        <div className="text-[13px] font-extrabold tracking-wide">❄ PRODUCTO CONGELADO</div>
        <div className="mt-0.5 text-[10px] leading-tight">
          MANTENER EN CADENA DE FRÍO
          <br />
          ENTREGA PRIORITARIA · NO DEMORAR
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between border-t border-black pt-1.5">
        <div className="text-[8.5px] leading-snug">
          <strong>REMITE</strong>
          <br />
          {ajustes.nombreNegocio}
          <br />
          {ajustes.telefonos}
        </div>
        <div className="text-right">
          <div className="font-mono text-[12px] font-extrabold">{pedido.clienteCodigo}</div>
          <div className="text-[8px]">cliente</div>
        </div>
      </div>
    </div>
  )
}
