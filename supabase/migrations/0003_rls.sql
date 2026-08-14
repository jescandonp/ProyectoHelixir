-- El equipo es pequeño y todos ven todo; lo que importa es que nadie
-- sin sesión toque nada.
alter table productos      enable row level security;
alter table clientes       enable row level security;
alter table direcciones    enable row level security;
alter table usuarios       enable row level security;
alter table ajustes        enable row level security;
alter table pedidos        enable row level security;
alter table pedido_items   enable row level security;

create policy "autenticados leen y escriben productos"    on productos    for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben clientes"     on clientes     for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben direcciones"  on direcciones  for all to authenticated using (true) with check (true);
create policy "autenticados leen usuarios"                on usuarios     for select to authenticated using (true);
create policy "autenticados leen y escriben ajustes"      on ajustes      for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben pedidos"      on pedidos      for all to authenticated using (true) with check (true);
create policy "autenticados leen y escriben items"        on pedido_items for all to authenticated using (true) with check (true);

-- Las políticas no bastan: Postgres comprueba primero el privilegio de tabla,
-- y las tablas nuevas no lo conceden a nadie. Sin estos GRANT, un usuario con
-- sesión recibe "permission denied" aunque su política lo permita.
grant select, insert, update, delete
  on productos, clientes, direcciones, ajustes, pedidos, pedido_items
  to authenticated;

-- Los usuarios se leen para mostrar el asesor; se crean por administración.
grant select on usuarios to authenticated;

-- El código de cliente (CL-0042) sale de esta secuencia al insertar.
grant usage on sequence clientes_codigo_seq to authenticated;

-- service_role va por fuera de RLS: lo usan las pruebas de integración
-- y las tareas administrativas. `anon` no recibe nada a propósito.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
