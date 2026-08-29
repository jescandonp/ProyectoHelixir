import { test, expect } from '@playwright/test'

const SUFIJO = Date.now().toString().slice(-6)
const NOMBRE_CLIENTE = `Cliente Prueba ${SUFIJO}`

test('toma un pedido de punta a punta y genera recibo y rótulo', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  // Cliente nuevo, sin salir de la pantalla
  await page.getByPlaceholder(/Buscar cliente/).fill(NOMBRE_CLIENTE)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()

  await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible()

  // Cuatro vainillas y cuatro maracuyás
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Vainilla/ }).click()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Maracuyá/ }).click()

  // 4×22.000 + 4×25.000 = 188.000; kilos = 8
  await expect(page.getByText('Subtotal · 8 kg')).toBeVisible()

  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)

  // El recibo salió con consecutivo y total en letras
  await expect(page.getByText(/ORDEN No\./)).toBeVisible()
  await expect(page.getByText(/M\/cte/)).toBeVisible()

  // El rótulo lleva el código de cliente, no la cédula
  await page.getByRole('button', { name: /Rótulo/ }).click()
  await expect(page.getByText(/^CL-\d{4}$/)).toBeVisible()
})

test('pedido nacional con transportadora de la lista', async ({ page }) => {
  const nombreCliente = `Cliente Prueba Transportadora ${Date.now().toString().slice(-6)}`

  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  await page.getByPlaceholder(/Buscar cliente/).fill(nombreCliente)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(nombreCliente)).toBeVisible()

  await page.getByRole('button', { name: /^Vainilla/ }).click()

  await page.getByRole('button', { name: 'Nacional' }).click()

  // Cubre lo que la prueba de integración de la Task 2 no puede probar en
  // Node: que `listarTransportadorasActivas()` de verdad llega al
  // desplegable, con la semilla completa y en el orden sembrado.
  const opciones = await page.getByLabel('Transportadora').locator('option').allTextContents()
  expect(opciones).toEqual([
    'Selecciona transportadora…', 'Interrapidísimo', 'Servientrega', 'TCC', 'Coordinadora', 'Otra…',
  ])

  await page.getByLabel('Transportadora').selectOption({ label: 'Servientrega' })
  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)
  await page.getByRole('button', { name: /Rótulo nacional/ }).click()
  await expect(page.getByText('Servientrega')).toBeVisible()
})

test('pedido nacional con transportadora "Otra"', async ({ page }) => {
  const nombreCliente = `Cliente Prueba Transportadora Otra ${Date.now().toString().slice(-6)}`

  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_CORREO!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_CLAVE!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo/)

  await page.getByPlaceholder(/Buscar cliente/).fill(nombreCliente)
  await page.getByText(/Crear cliente nuevo/).click()
  await page.getByPlaceholder('Teléfono').fill('3124567890')
  await page.getByPlaceholder('Dirección').fill('Cra 45 # 23-18')
  await page.getByPlaceholder('Barrio').fill('La Floresta')
  await page.getByPlaceholder('Ciudad').fill('Medellín')
  await page.getByRole('button', { name: 'Guardar y usar' }).click()
  await expect(page.getByText(nombreCliente)).toBeVisible()

  await page.getByRole('button', { name: /^Vainilla/ }).click()

  await page.getByRole('button', { name: 'Nacional' }).click()
  await page.getByLabel('Transportadora').selectOption({ label: 'Otra…' })
  await page.getByPlaceholder('Nombre de la transportadora').fill('Envíos del Valle')
  await page.getByRole('button', { name: /Generar recibo/ }).click()

  await expect(page).toHaveURL(/\/pedidos\/.+\/documentos/)
  await page.getByRole('button', { name: /Rótulo nacional/ }).click()
  await expect(page.getByText('Envíos del Valle')).toBeVisible()
})
