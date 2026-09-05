# Descuento fijo en pedidos — Documento de diseño

**Fecha:** 5 de septiembre de 2026
**Estado:** validado con el negocio, pendiente de plan de implementación
**Cubre:** captura de descuento manual en pesos al crear un pedido y su trazabilidad en los comprobantes.

---

## 1. Objetivo

Permitir al asesor aplicar un descuento manual, fijo y expresado en pesos
colombianos durante la creación de un pedido. El descuento debe quedar
congelado al confirmar el pedido y reflejarse coherentemente en el resumen,
el recibo impreso, el PDF y el texto del correo.

El resultado esperado es que el negocio pueda explicar el total de un pedido
con cuatro importes ordenados: subtotal de productos, descuento, domicilio y
total final.

## 2. Alcance y límites

### En alcance

- Campo numérico **Descuento** en el resumen de `/pedidos/nuevo`.
- Captura y restauración del descuento en el borrador local del navegador.
- Cálculo y persistencia del descuento al confirmar un pedido.
- Desglose condicional del descuento en el resumen, recibo HTML, PDF y texto
  plano del correo.
- Pruebas unitarias, de componente, persistencia y verificación manual del
  flujo completo.

### Fuera de alcance

| Excluido | Razón |
|---|---|
| Descuentos porcentuales | El negocio decidió un valor fijo en pesos. |
| Promociones, cupones o reglas automáticas | No se necesitan para el descuento manual puntual. |
| Editar un descuento después de crear el pedido | El importe se captura solo durante la creación y queda congelado. |
| Recalcular pedidos ya existentes | Deben conservar sus importes históricos almacenados. |
| Migración o nueva dependencia | `pedidos.descuento` ya existe como entero no negativo con valor por defecto `0`. |

## 3. Decisiones de negocio

| Decisión | Regla concreta |
|---|---|
| Unidad | Pesos colombianos enteros. |
| Momento de captura | Solo al crear el pedido, antes de confirmarlo. |
| Base del descuento | Se resta únicamente al subtotal de productos, antes de sumar domicilio. |
| Fórmula | `subtotal_neto = max(subtotal - descuento, 0)` y `total = subtotal_neto + valor_domicilio`. |
| Rango válido | Desde `$0` hasta el subtotal de productos, inclusive. No hay negativos ni decimales. |
| Cero | Significa sin descuento; no se dibuja una línea adicional en los comprobantes. |
| Inmutabilidad | El valor queda guardado en `pedidos.descuento` al confirmar; no se expone edición posterior. |
| Trazabilidad | Si el valor es mayor a cero, se muestra como línea explícita en recibo, PDF y correo. |

## 4. Arquitectura y flujo de datos

La solución reutiliza el campo `descuento` que ya forma parte de `DatosBorrador`,
`PedidoCompleto` y la tabla `pedidos`; no agrega una fuente de verdad paralela.

| Pieza | Responsabilidad |
|---|---|
| `lib/pedidos/calculos.ts` | Mantener la única fórmula autorizada: descuento sobre productos y domicilio sumado después. |
| `FormularioPedido.tsx` | Mantener el estado local `descuento`, incluirlo en el cálculo en vivo, el borrador local y el payload de confirmación. |
| `borrador-local.ts` | Persistir y restaurar el descuento durante las 24 horas de vigencia del borrador. Borradores antiguos sin campo se interpretan como `$0`. |
| `ResumenPedido.tsx` | Capturar el entero, mostrar el desglose y evitar que se confirme un valor fuera del rango. |
| `lib/db/pedidos.ts` | Recalcular en servidor antes de guardar/confirmar y rechazar valores inválidos aunque el cliente haya sido manipulado. |
| `Recibo.tsx` y `ReciboPdf.tsx` | Mostrar la misma línea `Descuento: -$…` solo cuando corresponda. |
| `lib/correo/recibo.ts` | Incluir en el texto plano el desglose monetario del recibo enviado. El PDF adjunto usa el mismo pedido congelado. |

No se persiste un `subtotal_neto`: es derivable de `subtotal` y `descuento`.
Evitar ese duplicado impide que dos columnas económicas se desincronicen.

## 5. Interfaz

En el bloque de resumen, el orden visible será:

1. Subtotal de productos y kilos.
2. Campo **Descuento**.
3. Línea de descuento cuando el valor sea mayor a cero.
4. Campo Domicilio.
5. Total.

El campo conserva el patrón actual de domicilio: teclado numérico, limpieza de
caracteres no numéricos y formato de pesos en los totales. El servidor es la
autoridad final sobre el límite máximo; el cliente lo comunica antes de
confirmar para evitar errores evitables.

En recibo HTML y PDF el desglose será:

```
Subtotal:          $44.000
Descuento:         -$4.000
Valor Domicilio:    $5.000
TOTAL:             $45.000
```

Con descuento `$0`, no aparece la segunda línea y los comprobantes mantienen
exactamente la presentación actual.

## 6. Errores y compatibilidad

- Un descuento negativo, no entero o superior al subtotal impide confirmar y
  produce un mensaje claro.
- Un borrador anterior que no incluya el nuevo campo se abre con descuento `$0`.
- La persistencia conserva la guarda existente de `estado = 'borrador'`; un
  pedido confirmado no acepta cambios económicos posteriores.
- Los pedidos históricos no se reescriben ni se recalculan. Como el campo
  nació con predeterminado `$0`, mantienen su total y presentación vigentes.

## 7. Pruebas y criterios de aceptación

### Pruebas automatizadas

- `calcularTotales`: sin descuento, descuento parcial, descuento igual al
  subtotal y domicilio posterior al descuento.
- Validación de límites en cliente y servidor: negativos, decimales y valores
  superiores al subtotal se rechazan.
- Borrador local: guarda, restaura y es compatible con un borrador antiguo sin
  el campo.
- Formulario/resumen: el total se actualiza y el payload contiene el descuento.
- Persistencia: el pedido confirmado almacena descuento, subtotal y total
  coherentes.
- Recibo HTML, PDF y texto de correo: muestran la línea solo si el descuento
  es mayor a cero.

### Verificación manual

Crear un pedido con productos, descuento y domicilio; confirmar que el total
cumple la fórmula, descargar el PDF y enviar el recibo por correo de prueba.
Repetir con descuento `$0` y confirmar que el aspecto no cambia.

## 8. Comandos

```powershell
# Ejecutar la suite unitaria
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test

# Lint y tipado
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run lint
npx tsc --noEmit

# Aplicación local (Supabase debe estar en ejecución)
& 'C:\Program Files\nodejs\node.exe' '.\node_modules\next\dist\bin\next' dev --hostname 127.0.0.1 --port 3000
```

## 9. Estructura y estilo

- `src/app/(app)/pedidos/nuevo/` contiene el flujo de creación.
- `src/components/pedido/` contiene la interfaz de resumen.
- `src/lib/pedidos/` mantiene cálculo, validación y borrador local puros.
- `src/lib/db/` persiste y vuelve a calcular los importes en servidor.
- `src/components/documentos/`, `src/lib/documentos/pdf/` y `src/lib/correo/`
  consumen el pedido confirmado; no vuelven a calcular totales.
- Las pruebas viven junto a cada módulo y usan Vitest; la verificación de
  navegador se suma a `e2e/` solo cuando se pueda ejecutar con credenciales
  locales válidas.

El estilo sigue el código existente: nombres en español, tipos explícitos en
fronteras, funciones puras para reglas económicas y validación antes de cada
escritura persistente.

## 10. Límites operativos

- **Siempre:** reutilizar `calcularTotales`, validar en cliente y servidor,
  probar casos límite y preservar pedidos históricos.
- **Pedir aprobación antes de:** cambiar el esquema de datos, introducir
  dependencias, alterar el comportamiento de pedidos ya confirmados o cambiar
  la regla económica aprobada.
- **Nunca:** guardar descuentos como porcentaje, aceptar un descuento mayor al
  subtotal, enviar secretos al cliente o modificar pedidos existentes durante
  esta iteración.
