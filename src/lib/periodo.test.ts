import { describe, it, expect } from 'vitest'
import { diaEnBogota, rangoDelDia, rangoDelMes, rangoEntre } from './periodo'

describe('diaEnBogota', () => {
  it('a las 7 p.m. de Colombia todavía es el mismo día, aunque en UTC ya sea el siguiente', () => {
    // 00:30 UTC del 15 son las 19:30 del 14 en Bogotá
    expect(diaEnBogota(new Date('2026-08-15T00:30:00Z'))).toBe('2026-08-14')
  })

  it('a las 6 a.m. de Colombia el día ya cambió', () => {
    expect(diaEnBogota(new Date('2026-08-15T11:00:00Z'))).toBe('2026-08-15')
  })
})

describe('rangoDelDia', () => {
  it('va de medianoche a medianoche en hora de Bogotá', () => {
    const rango = rangoDelDia(new Date('2026-08-14T18:00:00Z'))
    expect(rango.desde).toBe('2026-08-14T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-08-15T05:00:00.000Z')
  })

  it('un pedido de las 8 p.m. cae en el día correcto y no en el siguiente', () => {
    // Este es el error que se evita: con la zona del servidor en UTC,
    // ese pedido saldría en el listado de mañana.
    const instante = new Date('2026-08-15T01:00:00Z')   // 20:00 del 14 en Bogotá
    const rango = rangoDelDia(instante)
    expect(instante.toISOString() >= rango.desde).toBe(true)
    expect(instante.toISOString() < rango.hasta).toBe(true)
  })
})

describe('rangoDelMes', () => {
  it('cubre el mes completo', () => {
    const rango = rangoDelMes(new Date('2026-08-14T18:00:00Z'))
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-09-01T05:00:00.000Z')
  })

  it('el último día del mes sigue contando en ese mes', () => {
    // 2026-08-31 a las 23:00 de Bogotá = 2026-09-01T04:00Z
    const rango = rangoDelMes(new Date('2026-09-01T04:00:00Z'))
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-09-01T05:00:00.000Z')
  })

  it('en diciembre el mes siguiente es enero del año entrante', () => {
    const rango = rangoDelMes(new Date('2026-12-15T18:00:00Z'))
    expect(rango.desde).toBe('2026-12-01T05:00:00.000Z')
    expect(rango.hasta).toBe('2027-01-01T05:00:00.000Z')
  })
})

describe('rangoEntre', () => {
  it('incluye los dos días escogidos', () => {
    const rango = rangoEntre('2026-08-01', '2026-08-15')
    expect(rango.desde).toBe('2026-08-01T05:00:00.000Z')
    // el 15 completo cuenta: el corte es la medianoche del 16
    expect(rango.hasta).toBe('2026-08-16T05:00:00.000Z')
  })

  it('un solo día es un rango de 24 horas', () => {
    const rango = rangoEntre('2026-08-14', '2026-08-14')
    expect(rango.desde).toBe('2026-08-14T05:00:00.000Z')
    expect(rango.hasta).toBe('2026-08-15T05:00:00.000Z')
  })
})
