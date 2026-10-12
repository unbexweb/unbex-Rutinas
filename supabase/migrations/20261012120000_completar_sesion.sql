-- Unbex Rutinas · Fase 3 · completar_sesion
-- El alumno marca como hecho el entrenamiento que le toca. Todo en una transacción:
--  1. valida que la asignación sea suya, esté activa y la sesión sea la que corresponde
--  2. marca registros_sesion como completada (la crea si el alumno no registró nada)
--  3. avanza al siguiente estímulo (tras el 6 pasa a la semana siguiente)
--  4. si era S4·E6, finaliza la asignación
-- Devuelve true si con esta sesión terminó el plan.

create function public.completar_sesion(p_asignacion_id uuid, p_sesion_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_asig      public.asignaciones%rowtype;
  v_semana    smallint;
  v_estimulo  smallint;
  v_hoy       date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null or not public.is_alumno_activo() then
    raise exception 'No tenés permiso para completar entrenamientos' using errcode = '42501';
  end if;

  select * into v_asig
  from public.asignaciones
  where id = p_asignacion_id and alumno_id = v_uid
  for update;
  if not found then
    raise exception 'La asignación no existe' using errcode = 'P0002';
  end if;

  if v_asig.estado <> 'activa' then
    raise exception 'Tu plan ya está finalizado' using errcode = '22023';
  end if;

  select semana, estimulo into v_semana, v_estimulo
  from public.sesiones
  where id = p_sesion_id and plan_id = v_asig.plan_id;
  if not found
     or v_semana <> v_asig.semana_actual
     or v_estimulo <> v_asig.estimulo_actual then
    raise exception 'Ese no es el entrenamiento que te toca' using errcode = '22023';
  end if;

  insert into public.registros_sesion (asignacion_id, sesion_id, fecha, completada)
  values (p_asignacion_id, p_sesion_id, v_hoy, true)
  on conflict (asignacion_id, sesion_id)
  do update set completada = true, fecha = v_hoy;

  if v_asig.estimulo_actual = 6 and v_asig.semana_actual = 4 then
    update public.asignaciones
    set estado = 'finalizada', fecha_fin = v_hoy
    where id = p_asignacion_id;
    return true;
  elsif v_asig.estimulo_actual = 6 then
    update public.asignaciones
    set semana_actual = semana_actual + 1, estimulo_actual = 1
    where id = p_asignacion_id;
  else
    update public.asignaciones
    set estimulo_actual = estimulo_actual + 1
    where id = p_asignacion_id;
  end if;

  return false;
end;
$$;

revoke execute on function public.completar_sesion(uuid, uuid) from public, anon;
grant execute on function public.completar_sesion(uuid, uuid) to authenticated;
