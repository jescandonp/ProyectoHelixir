import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { PedidoCompleto } from '@/lib/db/pedidos'
import type { Ajustes } from '@/lib/db/ajustes'
import { formatearPesos } from '@/lib/dinero'
import { valorEnLetras } from '@/lib/numero-a-letras'
import { formatearFechaCo } from '@/lib/fecha'

const TAMANO_PAGINA: [number, number] = [226.77, 707]

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: 14, paddingVertical: 16, fontSize: 8.5 },
  centro: { textAlign: 'center' },
  nombreNegocio: { fontSize: 13, fontWeight: 700 },
  eslogan: { fontSize: 9, fontWeight: 700, marginTop: 2 },
  linea: { marginVertical: 4, borderTopWidth: 1.5, borderTopColor: '#000000' },
  ordenNo: { fontSize: 11, fontWeight: 700, textAlign: 'center', marginVertical: 6 },
  filaDato: { flexDirection: 'row', marginBottom: 1 },
  etiquetaDato: { width: 50, fontWeight: 700 },
  encabezadoDetalle: {
    backgroundColor: '#000000', color: '#ffffff', textAlign: 'center',
    paddingVertical: 2, fontWeight: 700, marginVertical: 6,
  },
  filaItem: { flexDirection: 'row', justifyContent: 'space-between' },
  separador: { marginVertical: 6, borderTopWidth: 1, borderTopColor: '#000000', borderStyle: 'dashed' },
  filaTotalParcial: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  total: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#000000',
    color: '#ffffff', paddingHorizontal: 6, paddingVertical: 4, marginVertical: 6, fontSize: 11, fontWeight: 700,
  },
  cajaPago: { borderWidth: 1.5, borderColor: '#000000', padding: 6, textAlign: 'center', marginTop: 6 },
})

function ReciboPdf({ pedido, ajustes }: { pedido: PedidoCompleto; ajustes: Ajustes }) {
  const pagado = pedido.estadoPago === 'pagado'

  return (
    <Document>
      <Page size={TAMANO_PAGINA} style={estilos.pagina}>
        <View style={estilos.centro}>
          <Text style={estilos.nombreNegocio}>{ajustes.nombreNegocio}</Text>
          <View style={estilos.linea} />
          <Text style={estilos.eslogan}>{ajustes.eslogan}</Text>
          <Text>PEDIDOS : {ajustes.telefonos}</Text>
        </View>

        <Text style={estilos.ordenNo}>ORDEN No. {pedido.consecutivo}</Text>

        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Cliente:</Text><Text>{pedido.clienteNombre}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Fecha:</Text><Text>{formatearFechaCo(pedido.fecha)}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Cédula:</Text><Text>{pedido.clienteCedula ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Teléfono:</Text><Text>{pedido.clienteTelefono ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Asesor:</Text><Text>{pedido.asesorCodigo ?? '—'}</Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Envío:</Text>
          <Text>
            {pedido.tipoEntrega === 'local'
              ? 'Local · domicilio propio'
              : `Nacional · ${pedido.transportadora ?? ''}`}
          </Text>
        </View>
        <View style={estilos.filaDato}>
          <Text style={estilos.etiquetaDato}>Dirección:</Text>
          <Text>{pedido.dirLinea} — {[pedido.dirBarrio, pedido.dirCiudad].filter(Boolean).join(' · ')}</Text>
        </View>

        <Text style={estilos.encabezadoDetalle}>Detalle del Pedido</Text>
        <Text style={{ marginBottom: 4 }}>{pedido.totalKg} Kg · Helado Artesanal en tarro</Text>

        {pedido.items.map((item, indice) => (
          <View key={indice} style={{ marginBottom: 2 }}>
            <View style={estilos.filaItem}>
              <Text>{item.cantidad} {item.descripcion}</Text>
              <Text>{formatearPesos(item.subtotal)}</Text>
            </View>
            {item.cantidad > 1 && (
              <Text style={{ fontSize: 7 }}>
                {item.cantidad} kg × {formatearPesos(item.precioUnitario)}
              </Text>
            )}
          </View>
        ))}

        <View style={estilos.separador} />
        <View style={estilos.filaTotalParcial}>
          <Text>Subtotal: {formatearPesos(pedido.subtotal)}</Text>
        </View>
        <View style={estilos.filaTotalParcial}>
          <Text>Valor Domicilio: {formatearPesos(pedido.valorDomicilio)}</Text>
        </View>

        <View style={estilos.total}>
          <Text>TOTAL:</Text>
          <Text>{formatearPesos(pedido.total)}</Text>
        </View>

        <Text style={{ fontWeight: 700 }}>Valor Total en Letras:</Text>
        <Text>{valorEnLetras(pedido.total)}</Text>

        {pedido.observaciones && (
          <>
            <Text style={{ fontWeight: 700, marginTop: 3 }}>Observaciones:</Text>
            <Text>{pedido.observaciones}</Text>
          </>
        )}

        <View style={estilos.cajaPago}>
          {pagado ? (
            <>
              <Text style={{ fontWeight: 700 }}>PAGADO ✓</Text>
              {pedido.fechaPago && <Text>{formatearFechaCo(pedido.fechaPago)}</Text>}
            </>
          ) : (
            <>
              <Text style={{ fontWeight: 700 }}>PENDIENTE DE PAGO</Text>
              <Text>{ajustes.datosPago}</Text>
            </>
          )}
        </View>

        <View style={estilos.separador} />
        <Text style={estilos.centro}>{ajustes.pieRecibo}</Text>
      </Page>
    </Document>
  )
}

export async function renderReciboPdf(pedido: PedidoCompleto, ajustes: Ajustes): Promise<Buffer> {
  return renderToBuffer(<ReciboPdf pedido={pedido} ajustes={ajustes} />)
}
