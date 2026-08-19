import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUFIJO = Date.now().toString().slice(-6)
const NOMBRE_CLIENTE = `Cobro Prueba ${SUFIJO}`

// El pedido que crea esta prueba llega a `confirmado` por el flujo real (con
// consecutivo real asignado por `asignar_consecutivo`), no por una llamada
// directa al RPC como en las pruebas de integración. Aun así se limpia con
// el mismo patrón que ellas (ver `limpiarClienteDePrueba` en
// `src/lib/db/pedidos.integracion.test.ts`): dejar basura de pruebas en la
// base local ya causó un bug real (128 pedidos huérfanos con
// `estado = 'borrador'` y consecutivo asignado, ver informe de la Tarea 6),
// y "nada se borra" es una regla de la aplicación de producción — no exige
// que un fixture de prueba efímero, contra una base local, sobreviva para
// siempre. Como el pedido llega a `confirmado`/`pagado` (nunca a
// `anulado`), el borrado no deja huecos falsos en un histórico real: es
// dato de prueba, no una venta.
test.afterEach(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: cliente } = await supabase
    .from('clientes').select('id').eq('nombre', NOMBRE_CLIENTE).maybeSingle()
  if (!cliente) return

  const { error: errorPedidos } = await supabase.from('pedidos').delete().eq('cliente_id', cliente.id)
  if (errorPedidos) throw new Error(`No se pudieron limpiar los pedidos de prueba: ${errorPedidos.message}`)

  const { error: errorCliente } = await supabase.from('clientes').delete().eq('id', cliente.id)
  if (errorCliente) throw new Error(`No se pudo limpiar el cliente de prueba: ${errorCliente.message}`)
})

test('toma un pedido, lo cobra desde la lista y el recibo sale pagado', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  // Un pedido nuevo con un cliente nuevo
  await page.getByPlaceholder(/Buscar cliente/).fill(NOMBRE_CLIENTE)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible()

  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Vainilla/ }).click()
  await page.getByRole('button', { name: /Generar recibo/ }).click()
  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)

  const consecutivo = (await page.getByText(/ORDEN No\./).innerText())
    .replace('ORDEN No.', '').trim()

  // El pedido aparece en la lista de hoy y suma a lo pendiente por cobrar
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click()
  await expect(page).toHaveURL(/\/pedidos(\?|$)/)
  const fila = page.getByRole('row').filter({ hasText: consecutivo })
  await expect(fila).toBeVisible()

  // Cobrarlo
  await fila.getByRole('button', { name: 'Pagado' }).click()
  await expect(fila.getByText('pagado')).toBeVisible()

  // El recibo reimpreso ya dice PAGADO
  await fila.getByRole('link', { name: 'Documentos' }).click()
  await expect(page.getByText(/PAGADO/)).toBeVisible()
  await expect(page.getByText('PENDIENTE DE PAGO')).toHaveCount(0)
})
