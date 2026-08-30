import ExcelJS from 'exceljs'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'
import { formatearFechaCo } from '@/lib/fecha'

export async function generarExcelPedidos(filas: FilaPedido[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Pedidos')

  hoja.columns = [
    { header: 'Orden', key: 'consecutivo', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 20 },
    { header: 'Cliente', key: 'clienteNombre', width: 28 },
    { header: 'Ciudad', key: 'dirCiudad', width: 18 },
    { header: 'Kg', key: 'totalKg', width: 10 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Estado de pago', key: 'estadoPago', width: 16 },
  ]

  for (const fila of filas) {
    hoja.addRow({
      consecutivo: fila.consecutivo,
      fecha: formatearFechaCo(fila.fecha),
      clienteNombre: fila.clienteNombre,
      dirCiudad: fila.dirCiudad,
      totalKg: fila.totalKg,
      total: fila.total,
      estado: fila.estado,
      estadoPago: fila.estadoPago,
    })
  }

  hoja.getColumn('total').numFmt = '#,##0'
  hoja.getRow(1).font = { bold: true }

  return Buffer.from(await libro.xlsx.writeBuffer())
}
