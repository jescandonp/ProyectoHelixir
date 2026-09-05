-- Alta de un operador (asesor) en producción.
--
-- Son DOS pasos y el dashboard solo hace el primero:
--
--   1. Authentication → Users → Add user → marcar "Auto Confirm User".
--      Eso crea la fila en `auth.users`, con la que ya puede iniciar sesión.
--   2. Correr esto en SQL Editor. Sin esta fila la sesión abre, pero
--      `obtenerUsuarioActual` devuelve null y el pedido sale sin asesor.
--
-- Cambiar el correo, el nombre y el código antes de correr. El código de
-- asesor es único y queda impreso en el recibo: '001', '002', …

insert into usuarios (id, nombre, codigo_asesor)
select id, 'Adriana', '002'
from auth.users
where email = 'adriana@heladeria.local'
on conflict (id) do nothing;

-- Comprobación: debe listar al operador recién creado.
select u.codigo_asesor, u.nombre, a.email
from usuarios u
join auth.users a on a.id = u.id
order by u.codigo_asesor;

-- Para quitarle el acceso a alguien: la columna `usuarios.activo` NO sirve,
-- la aplicación nunca la consulta. Hay que ir a Authentication → Users y
-- borrar o banear al usuario. La fila de `usuarios` se puede dejar: los
-- pedidos viejos la referencian para mostrar quién los tomó.
