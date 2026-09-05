import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'
import { formatearPesos } from '@/lib/dinero'
import { formatearFechaCo } from '@/lib/fecha'

const estilos = StyleSheet.create({
  pagina: { padding: 24, fontSize: 9, fontFamily: 'Helvetica' },
  titulo: { fontSize: 14, marginBottom: 12, fontWeight: 700 },
  fila: {
    flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingVertical: 4,
  },
  filaEncabezado: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000000',
    paddingVertical: 4, fontWeight: 700,
  },
  colOrden: { width: '14%' },
  colFecha: { width: '18%' },
  colCliente: { width: '26%' },
  colCiudad: { width: '16%' },
  colKg: { width: '8%', textAlign: 'right' },
  colTotal: { width: '12%', textAlign: 'right' },
  colEstado: { width: '6%' },
})

function ListadoPedidosPdf({ filas, titulo }: { filas: FilaPedido[]; titulo: string }) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <View style={estilos.filaEncabezado}>
          <Text style={estilos.colOrden}>Orden</Text>
          <Text style={estilos.colFecha}>Fecha</Text>
          <Text style={estilos.colCliente}>Cliente</Text>
          <Text style={estilos.colCiudad}>Ciudad</Text>
          <Text style={estilos.colKg}>Kg</Text>
          <Text style={estilos.colTotal}>Total</Text>
          <Text style={estilos.colEstado}>Estado</Text>
        </View>
        {filas.map((fila) => (
          <View key={fila.id} style={estilos.fila}>
            <Text style={estilos.colOrden}>{fila.consecutivo}</Text>
            <Text style={estilos.colFecha}>{formatearFechaCo(fila.fecha)}</Text>
            <Text style={estilos.colCliente}>{fila.clienteNombre}</Text>
            <Text style={estilos.colCiudad}>{fila.dirCiudad ?? ''}</Text>
            <Text style={estilos.colKg}>{fila.totalKg}</Text>
            <Text style={estilos.colTotal}>{formatearPesos(fila.total)}</Text>
            <Text style={estilos.colEstado}>{fila.estado}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export async function renderListadoPedidosPdf(filas: FilaPedido[], titulo: string): Promise<Buffer> {
  return renderToBuffer(<ListadoPedidosPdf filas={filas} titulo={titulo} />)
}
