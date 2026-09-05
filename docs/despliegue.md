# Despliegue a producción — Vercel + Supabase

Guía de una sola pasada. Al final hay pedidos reales entrando por una URL
pública. Los pasos van en orden porque el 3 es el que impide que un
desconocido lea la cartera de clientes.

**Arquitectura desplegada:** Next.js en Vercel (SSR + acciones de servidor)
contra un Postgres de Supabase. No hay backend propio: la autorización vive
en las políticas RLS de la base.

---

## Antes de empezar

- Cuenta de Supabase y cuenta de Vercel.
- El repositorio en GitHub: `jescandonp/ProyectoHelixir`.
- **Vercel Pro ($20/mes).** El plan Hobby está restringido por contrato a uso
  personal no comercial: *"Hobby teams are restricted to non-commercial
  personal use only. All commercial usage of the platform requires either a
  Pro or Enterprise plan."* Un sistema que toma pedidos del negocio es uso
  comercial.

---

## Paso 1 — Crear el proyecto en Supabase

Dashboard → **New project**.

- **Región:** `East US (North Virginia)`. Desde Colombia da menos latencia
  que São Paulo, y es donde Vercel sirve por defecto.
- **Contraseña de Postgres:** generarla y guardarla en el gestor de
  contraseñas. Se necesita en el paso 2 y no se puede volver a ver.

De **Project Settings → API** anotar dos valores:

| Valor | Va a |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Clave `anon` / `publishable` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

La clave `service_role` **no se toca**: salta RLS por completo y solo la usan
las pruebas locales. Si llega a Vercel, cualquiera con el bundle tiene la base.

## Paso 2 — Aplicar el esquema

Desde la raíz del repositorio:

```bash
npx supabase link --project-ref <ref-del-proyecto>
```

```bash
npx supabase db push
```

Eso corre las cuatro migraciones de `supabase/migrations/`: esquema, función
de consecutivo, políticas RLS con sus GRANT, y la semilla de los 21 sabores
con sus precios. La base queda utilizable de una.

Comprobar en **Table Editor** que `productos` trae las 21 filas y que
`ajustes` trae una.

## Paso 3 — Cerrar el registro público ⚠️

**Esto es obligatorio y va antes de repartir la URL.**

Authentication → **Sign In / Providers** → Email → desactivar
**"Allow new users to sign up"**.

El porqué: las políticas de `0003_rls.sql` le dan lectura y escritura de
*todo* a cualquier usuario con rol `authenticated`, y la aplicación no
comprueba nada más allá de que haya sesión. Con el registro abierto,
cualquiera que cree una cuenta en el proyecto entra a ver y editar todos los
pedidos, clientes, cédulas y teléfonos. Los operadores se crean a mano
(paso 4); nadie se registra solo.

## Paso 4 — Crear los operadores

Authentication → **Users** → Add user → marcar **Auto Confirm User**.

Después correr `supabase/alta-operador.sql` en el **SQL Editor**, editando
correo, nombre y código. Son dos pasos: sin la fila en `usuarios` la sesión
abre igual, pero el pedido sale sin asesor y sin código en el recibo.

## Paso 5 — Desplegar en Vercel

**Add New → Project → Import** el repositorio. Framework Next.js: se detecta
solo, no hay que tocar comandos de build.

Cargar las variables en **Environment Variables**, marcadas para *Production*
y *Preview*:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Detalle que muerde: el prefijo `NEXT_PUBLIC_` significa que esos valores se
incrustan en el JavaScript **durante el build**, no se leen al ejecutar. Si
se cargan después del primer despliegue hay que volver a desplegar
(*Redeploy*), o la aplicación sale al aire apuntando a ninguna parte.

No cargar `SUPABASE_SERVICE_ROLE_KEY`, `E2E_CORREO` ni `E2E_CLAVE`.

## Paso 6 — Configurar el negocio

Entrar a `/ajustes` con la URL de producción y llenar nombre del negocio,
eslogan, teléfonos, datos de pago, prefijo del consecutivo y valor de
domicilio. Esos campos salen impresos en cada recibo y rótulo; la migración
los deja vacíos a propósito.

## Paso 7 — Verificar en producción

1. Abrir la URL sin sesión → debe rebotar a `/ingresar`.
2. Entrar con un operador real.
3. Tomar un pedido de prueba de punta a punta: cliente nuevo, dos sabores,
   generar recibo. Revisar consecutivo, total en letras y rótulo.
4. Cobrarlo desde `/pedidos` y ver que queda en pagado.
5. Borrar el pedido y el cliente de prueba desde el SQL Editor — en la
   aplicación nada se borra, y un pedido de prueba con consecutivo real
   ensucia el histórico y la numeración.

---

## Respaldos — decidir esto ahora, no después

El plan **Free de Supabase no incluye respaldos** ("Backups: not included") y
pausa el proyecto tras una semana sin actividad. Para pedidos y cartera de
clientes reales eso es un riesgo de pérdida total sin vuelta atrás.

Dos caminos:

- **Supabase Pro, $25/mes.** Respaldos diarios con 7 días de retención, sin
  pausa por inactividad. Es la opción sensata cuando el negocio ya factura
  contra este sistema.
- **Seguir en Free con respaldo manual.** Aceptable el primer mes mientras se
  valida el uso, siempre que el volcado se corra de verdad y en calendario:

  ```bash
  npx supabase db dump --db-url "<connection-string>" -f respaldo-AAAA-MM-DD.sql
  ```

  Guardar el archivo fuera de la máquina de trabajo. Un respaldo que vive en
  el mismo portátil que se puede dañar no es un respaldo.

El límite de 500 MB del plan Free no aprieta: son filas de texto y enteros,
sin imágenes. La pausa por inactividad tampoco, si el negocio opera a diario.

**Costo mensual:** Vercel Pro $20 + Supabase Free $0 = **$20**, o $45 con
Supabase Pro.

---

## Notas de operación

- **Las pruebas E2E son sensibles al arranque en frío.** Las aserciones usan
  el timeout de 5 s de Playwright, y Turbopack tarda más que eso en compilar
  una ruta la primera vez. Contra un servidor recién levantado fallan; contra
  uno caliente pasan en serie y en paralelo. Si se montan en CI, hay que
  calentar las rutas antes o subir el `expect.timeout`.
- **`usuarios.activo` no hace nada.** La aplicación nunca la consulta. Para
  quitar un acceso hay que borrar o banear al usuario en Authentication.
- **Las horas se calculan en Bogotá, no en la del servidor.** Vercel corre en
  UTC; por eso todo rango de fechas pasa por `src/lib/periodo.ts` y toda fecha
  en pantalla por `formatearFechaCo`. No usar `toLocaleString` directo.
