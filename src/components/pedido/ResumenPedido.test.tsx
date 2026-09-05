import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResumenPedido } from './ResumenPedido'

const TRANSPORTADORAS = [
  { id: 't1', nombre: 'Interrapidísimo' },
  { id: 't2', nombre: 'Servientrega' },
]

function propsBase(extra: Partial<Parameters<typeof ResumenPedido>[0]> = {}) {
  return {
    items: [], totales: { subtotal: 0, totalKg: 0, total: 0 }, valorDomicilio: 0,
    tipoEntrega: 'nacional' as const, transportadora: '', estadoPago: 'pendiente' as const,
    observaciones: '', problemas: [], confirmando: false,
    transportadoras: TRANSPORTADORAS,
    onCambiarDomicilio: vi.fn(), onCambiarEntrega: vi.fn(),
    onCambiarTransportadora: vi.fn(), onCambiarPago: vi.fn(),
    onCambiarObservaciones: vi.fn(), onConfirmar: vi.fn(),
    ...extra,
  }
}

describe('ResumenPedido — transportadora', () => {
  it('no muestra el selector de transportadora en entrega local', () => {
    render(<ResumenPedido {...propsBase({ tipoEntrega: 'local' })} />)
    expect(screen.queryByLabelText('Transportadora')).toBeNull()
  })

  it('lista las transportadoras activas como opciones en entrega nacional', () => {
    render(<ResumenPedido {...propsBase()} />)
    const select = screen.getByLabelText('Transportadora')
    expect(screen.getByRole('option', { name: 'Interrapidísimo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Servientrega' })).toBeInTheDocument()
    expect(select).toBeInTheDocument()
  })

  it('al elegir una transportadora de la lista, avisa al padre con su nombre', () => {
    const onCambiarTransportadora = vi.fn()
    render(<ResumenPedido {...propsBase({ onCambiarTransportadora })} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: 'Servientrega' } })
    expect(onCambiarTransportadora).toHaveBeenCalledWith('Servientrega')
  })

  it('al elegir "Otra", muestra un campo de texto libre', () => {
    const onCambiarTransportadora = vi.fn()
    render(<ResumenPedido {...propsBase({ onCambiarTransportadora })} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: '__otra__' } })
    expect(screen.getByPlaceholderText('Nombre de la transportadora')).toBeInTheDocument()
    expect(onCambiarTransportadora).toHaveBeenCalledWith('')
  })

  it('escribir en el campo libre avisa al padre con el texto escrito', () => {
    const onCambiarTransportadora = vi.fn()
    render(<ResumenPedido {...propsBase({ onCambiarTransportadora })} />)
    fireEvent.change(screen.getByLabelText('Transportadora'), { target: { value: '__otra__' } })
    fireEvent.change(screen.getByPlaceholderText('Nombre de la transportadora'), {
      target: { value: 'Envíos del Valle' },
    })
    expect(onCambiarTransportadora).toHaveBeenCalledWith('Envíos del Valle')
  })

  it('si ya trae un valor que no está en la lista, arranca en modo "Otra" con el texto visible', () => {
    render(<ResumenPedido {...propsBase({ transportadora: 'Envíos del Valle' })} />)
    expect(screen.getByPlaceholderText('Nombre de la transportadora')).toHaveValue('Envíos del Valle')
  })
})
