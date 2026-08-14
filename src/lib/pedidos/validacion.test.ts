import { describe, it, expect } from 'vitest'
import { validarParaConfirmar, type BorradorPedido } from './validacion'

function borradorValido(): BorradorPedido {
  return {
    clienteId: 'c1',
    direccionId: 'd1',
    items: [{ productoId: 'p1', descripcion: 'Vainilla', cantidad: 4, precioUnitario: 22000 }],
    tipoEntrega: 'local',
    transportadora: null,
  }
}

describe('validarParaConfirmar', () => {
  it('acepta un borrador completo', () => {
    expect(validarParaConfirmar(borradorValido())).toEqual([])
  })

  it('exige cliente', () => {
    const p = validarParaConfirmar({ ...borradorValido(), clienteId: null })
    expect(p).toContain('Falta escoger el cliente')
  })

  it('exige dirección: sin ella el rótulo sale inservible', () => {
    const p = validarParaConfirmar({ ...borradorValido(), direccionId: null })
    expect(p).toContain('Falta escoger la dirección de entrega')
  })

  it('exige al menos un ítem', () => {
    const p = validarParaConfirmar({ ...borradorValido(), items: [] })
    expect(p).toContain('El pedido no tiene productos')
  })

  it('exige transportadora cuando el envío es nacional', () => {
    const p = validarParaConfirmar({
      ...borradorValido(), tipoEntrega: 'nacional', transportadora: null,
    })
    expect(p).toContain('Falta la transportadora del envío nacional')
  })

  it('no exige transportadora en entrega local', () => {
    expect(validarParaConfirmar(borradorValido())).toEqual([])
  })

  it('rechaza un ítem libre sin descripción, porque el sistema no adivina', () => {
    const p = validarParaConfirmar({
      ...borradorValido(),
      items: [{ productoId: null, descripcion: '  ', cantidad: 1, precioUnitario: 30000 }],
    })
    expect(p).toContain('Hay un ítem libre sin descripción')
  })

  it('rechaza un ítem libre en cero, porque el sistema nunca infiere un precio', () => {
    const p = validarParaConfirmar({
      ...borradorValido(),
      items: [{ productoId: null, descripcion: 'Experimental', cantidad: 1, precioUnitario: 0 }],
    })
    expect(p).toContain('Hay un ítem libre sin precio: Experimental')
  })

  it('acumula todos los problemas de una vez', () => {
    const p = validarParaConfirmar({
      clienteId: null, direccionId: null, items: [], tipoEntrega: 'local', transportadora: null,
    })
    expect(p).toHaveLength(3)
  })
})
