import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { generarExcelPedidos } from './a-excel'
import type { FilaPedido } from '@/lib/db/pedidos-consultas'

const FILA: FilaPedido = {
  id: 'p1', consecutivo: 'PED-000148', fecha: '2026-08-11T21:17:00.000Z',
  clienteNombre: 'Juanito González', clienteCodigo: 'CL-0042', dirCiudad: 'Medellín',
  totalKg: 10, total: 240000, estado: 'confirmado', estadoPago: 'pendiente',
}

describe('generarExcelPedidos', () => {
  it('arma una hoja "Pedidos" con encabezado y una fila por pedido', async () => {
    const buffer = await generarExcelPedidos([FILA])
    const libro = new ExcelJS.Workbook()
    // exceljs/index.d.ts sombrea `Buffer` localmente (extends ArrayBuffer),
    // así que la firma de `.load()` exige un `Buffer` distinto al real de
    // @types/node — un bug conocido de sus tipos, no del código. `Buffer.from()`
    // de @types/node ya garantiza en runtime que esto es un Buffer válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await libro.xlsx.load(buffer as any)
    const hoja = libro.getWorksheet('Pedidos')!

    expect(hoja.getRow(1).getCell(1).value).toBe('Orden')
    expect(hoja.getRow(2).getCell(1).value).toBe('PED-000148')
    expect(hoja.getRow(2).getCell(3).value).toBe('Juanito González')
    expect(hoja.getRow(2).getCell(4).value).toBe('Medellín')
    expect(hoja.getRow(2).getCell(6).value).toBe(240000)
  })

  it('con ciudad nula, deja la celda vacía en vez de lanzar', async () => {
    const buffer = await generarExcelPedidos([{ ...FILA, dirCiudad: null }])
    const libro = new ExcelJS.Workbook()
    // exceljs/index.d.ts sombrea `Buffer` localmente (extends ArrayBuffer),
    // así que la firma de `.load()` exige un `Buffer` distinto al real de
    // @types/node — un bug conocido de sus tipos, no del código. `Buffer.from()`
    // de @types/node ya garantiza en runtime que esto es un Buffer válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await libro.xlsx.load(buffer as any)
    const hoja = libro.getWorksheet('Pedidos')!
    expect(hoja.getRow(2).getCell(4).value).toBeNull()
  })

  it('con una lista vacía, arma solo el encabezado', async () => {
    const buffer = await generarExcelPedidos([])
    const libro = new ExcelJS.Workbook()
    // exceljs/index.d.ts sombrea `Buffer` localmente (extends ArrayBuffer),
    // así que la firma de `.load()` exige un `Buffer` distinto al real de
    // @types/node — un bug conocido de sus tipos, no del código. `Buffer.from()`
    // de @types/node ya garantiza en runtime que esto es un Buffer válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await libro.xlsx.load(buffer as any)
    const hoja = libro.getWorksheet('Pedidos')!
    expect(hoja.rowCount).toBe(1)
  })
})
