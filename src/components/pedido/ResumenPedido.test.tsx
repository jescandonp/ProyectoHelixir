import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ResumenPedido } from './ResumenPedido'

afterEach(cleanup)

const TRANSPORTADORAS = [
  { id: 't1', nombre: 'Interrapidísimo' },
  { id: 't2', nombre: 'Servientrega' },
]

function propsBase(extra: Partial<Parameters<typeof ResumenPedido>[0]> = {}) {
  return {
    items: [], totales: { subtotal: 0, totalKg: 0, total: 0 }, valorDomicilio: 0,
    descuento: 0,
    tipoEntrega: 'nacional' as const, transportadora: '', estadoPago: 'pendiente' as const,
    observaciones: '', problemas: [], confirmando: false,
    transportadoras: TRANSPORTADORAS,
    onCambiarDomicilio: vi.fn(), onCambiarEntrega: vi.fn(),
    onCambiarDescuento: vi.fn(),
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

describe('ResumenPedido — descuento', () => {
  it('comunica el descuento como pesos enteros', () => {
    const onCambiarDescuento = vi.fn()
    render(<ResumenPedido {...propsBase({
      onCambiarDescuento,
      totales: { subtotal: 22000, totalKg: 1, total: 22000 },
    })} />)

    fireEvent.change(screen.getByLabelText('Descuento'), { target: { value: '4.000' } })

    expect(onCambiarDescuento).toHaveBeenCalledWith(4000)
  })

  it('no comunica un descuento mayor que el subtotal', () => {
    const onCambiarDescuento = vi.fn()
    render(<ResumenPedido {...propsBase({
      onCambiarDescuento,
      totales: { subtotal: 22000, totalKg: 1, total: 22000 },
    })} />)

    fireEvent.change(screen.getByLabelText('Descuento'), { target: { value: '25000' } })

    expect(onCambiarDescuento).toHaveBeenCalledWith(22000)
  })

  it('muestra la línea de descuento solamente cuando es positivo', () => {
    const { rerender } = render(
      <ResumenPedido {...propsBase({
        descuento: 4000,
        totales: { subtotal: 22000, totalKg: 1, total: 18000 },
      })} />,
    )
    expect(screen.getAllByText('Descuento')).toHaveLength(2)

    rerender(<ResumenPedido {...propsBase()} />)
    expect(screen.getByText('Descuento')).toBeInTheDocument()
    expect(screen.queryByText(/−/)).toBeNull()
  })
})
