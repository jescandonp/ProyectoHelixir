import { describe, it, expect } from 'vitest'
import { numeroALetras, valorEnLetras } from './numero-a-letras'

describe('numeroALetras — unidades y decenas', () => {
  it('cero', () => expect(numeroALetras(0)).toBe('cero'))
  it('uno', () => expect(numeroALetras(1)).toBe('uno'))
  it('quince', () => expect(numeroALetras(15)).toBe('quince'))
  it('dieciséis lleva tilde', () => expect(numeroALetras(16)).toBe('dieciséis'))
  it('veintiuno va junto', () => expect(numeroALetras(21)).toBe('veintiuno'))
  it('veintidós lleva tilde', () => expect(numeroALetras(22)).toBe('veintidós'))
  it('treinta y uno va separado', () => expect(numeroALetras(31)).toBe('treinta y uno'))
})

describe('numeroALetras — centenas', () => {
  it('cien exacto no es ciento', () => expect(numeroALetras(100)).toBe('cien'))
  it('ciento uno', () => expect(numeroALetras(101)).toBe('ciento uno'))
  it('quinientos es irregular', () => expect(numeroALetras(500)).toBe('quinientos'))
  it('setecientos es irregular', () => expect(numeroALetras(700)).toBe('setecientos'))
  it('novecientos es irregular', () => expect(numeroALetras(900)).toBe('novecientos'))
  it('doscientos treinta y dos', () => expect(numeroALetras(232)).toBe('doscientos treinta y dos'))
})

describe('numeroALetras — miles', () => {
  it('mil sin "uno" delante', () => expect(numeroALetras(1000)).toBe('mil'))
  it('mil uno', () => expect(numeroALetras(1001)).toBe('mil uno'))
  it('dos mil', () => expect(numeroALetras(2000)).toBe('dos mil'))
  it('veintiún mil apocopa con tilde', () => expect(numeroALetras(21000)).toBe('veintiún mil'))
  it('treinta y un mil apocopa sin tilde', () => expect(numeroALetras(31000)).toBe('treinta y un mil'))
  it('veintidós mil', () => expect(numeroALetras(22000)).toBe('veintidós mil'))
  it('doscientos cuarenta mil', () => expect(numeroALetras(240000)).toBe('doscientos cuarenta mil'))
  it('cien mil exacto', () => expect(numeroALetras(100000)).toBe('cien mil'))
  it('total real de un pedido', () =>
    expect(numeroALetras(286000)).toBe('doscientos ochenta y seis mil'))
})

describe('numeroALetras — millones', () => {
  it('un millón, no "uno millón"', () => expect(numeroALetras(1000000)).toBe('un millón'))
  it('dos millones en plural', () => expect(numeroALetras(2000000)).toBe('dos millones'))
  it('veintiún millones apocopa', () => expect(numeroALetras(21000000)).toBe('veintiún millones'))
  it('millones con miles y unidades', () =>
    expect(numeroALetras(30640000)).toBe('treinta millones seiscientos cuarenta mil'))
  it('caso completo', () =>
    expect(numeroALetras(1234567)).toBe(
      'un millón doscientos treinta y cuatro mil quinientos sesenta y siete',
    ))
})

describe('valorEnLetras', () => {
  it('capitaliza y agrega M/cte', () => {
    expect(valorEnLetras(240000)).toBe('Doscientos cuarenta mil M/cte')
  })
  it('funciona con un millón', () => {
    expect(valorEnLetras(1000000)).toBe('Un millón M/cte')
  })
})

describe('numeroALetras — entradas inválidas', () => {
  it('rechaza negativos', () => expect(() => numeroALetras(-1)).toThrow())
  it('rechaza decimales', () => expect(() => numeroALetras(10.5)).toThrow())
})
