-- El `update ... returning` toma un bloqueo de fila sobre la única fila de
-- `ajustes`, así que dos confirmaciones simultáneas no pueden obtener el
-- mismo número: la segunda espera a que la primera termine.
create or replace function asignar_consecutivo(p_pedido_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_prefijo text;
  v_numero integer;
  v_consecutivo text;
  v_existente text;
begin
  select consecutivo into v_existente from pedidos where id = p_pedido_id;
  if v_existente is not null then
    return v_existente;   -- idempotente: confirmar dos veces no quema un número
  end if;

  update ajustes
     set siguiente_consecutivo = siguiente_consecutivo + 1
   where id = true
  returning prefijo_consecutivo, siguiente_consecutivo - 1
       into v_prefijo, v_numero;

  v_consecutivo := v_prefijo || '-' || lpad(v_numero::text, 6, '0');

  update pedidos
     set consecutivo = v_consecutivo
   where id = p_pedido_id;

  return v_consecutivo;
end;
$$;
