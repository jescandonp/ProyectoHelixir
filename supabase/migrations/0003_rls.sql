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
