import { describe, it, expect } from 'vitest'
import { correoValido } from './validacion'

describe('correoValido', () => {
  it('acepta un correo con formato normal', () => {
    expect(correoValido('cliente@correo.com')).toBe(true)
  })

  it('acepta subdominios y sufijos largos', () => {
    expect(correoValido('pedidos@mail.minegocio.com.co')).toBe(true)
  })

  it('rechaza sin arroba', () => {
    expect(correoValido('cliente-correo.com')).toBe(false)
  })

  it('rechaza sin dominio', () => {
    expect(correoValido('cliente@')).toBe(false)
  })

  it('rechaza con espacios', () => {
    expect(correoValido('cliente @correo.com')).toBe(false)
  })

  it('rechaza vacío', () => {
    expect(correoValido('')).toBe(false)
    expect(correoValido('   ')).toBe(false)
  })
})
