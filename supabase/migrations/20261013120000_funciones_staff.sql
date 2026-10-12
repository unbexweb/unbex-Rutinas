-- Unbex Rutinas · Fase 4 · Funciones atómicas del panel de staff
-- Todas son security definer, validan is_staff() y filtran por el gym del usuario.

-- ---------------------------------------------------------------------------
-- Interna: copia los bloques (y sus ejercicios) de una sesión a otra.
-- No se expone a ningún rol: la usan duplicar_plan y copiar_semana.
-- ---------------------------------------------------------------------------
create function public._clonar_bloques(p_origen uuid, p_destino uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  b    record;
  v_nb uuid;
begin
  for b in
    select * from public.bloques where sesion_id = p_origen order by orden, created_at
  loop
    insert into public.bloques (sesion_id, orden, nombre, indicacion)
    values (p_destino, b.orden, b.nombre, b.indicacion)
    returning id into v_nb;

    insert into public.bloque_ejercicios
      (bloque_id, orden, ejercicio_id, alternativa_id, series, reps,
       carga_sugerida, registra_carga, nota)
    select v_nb, orden, ejercicio_id, alternativa_id, series, reps,
           carga_sugerida, registra_carga, nota
    from public.bloque_ejercicios
    where bloque_id = b.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- asignar_plan: finaliza la asignación activa (si hay) y crea la nueva en S1·E1.
-- ---------------------------------------------------------------------------
create function public.asignar_plan(p_alumno_id uuid, p_plan_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gym  uuid := public.current_gym_id();
  v_plan public.planes%rowtype;
  v_new  uuid;
  v_hoy  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.is_staff() then
    raise exception 'Solo el staff puede asignar planes' using errcode = '42501';
  end if;

  select * into v_plan from public.planes where id = p_plan_id and gym_id = v_gym;
  if not found then
    raise exception 'El plan no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  if v_plan.alumno_id is not null and v_plan.alumno_id <> p_alumno_id then
    raise exception 'Ese plan es personalizado para otro alumno' using errcode = '22023';
  end if;

  -- bloquea al alumno: dos asignaciones simultáneas no pueden pisarse
  perform 1 from public.profiles
  where id = p_alumno_id and gym_id = v_gym and rol = 'alumno'
  for update;
  if not found then
    raise exception 'El alumno no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  update public.asignaciones
  set estado = 'finalizada', fecha_fin = v_hoy
  where alumno_id = p_alumno_id and estado = 'activa';

  insert into public.asignaciones (alumno_id, plan_id, semana_actual, estimulo_actual, estado, fecha_inicio)
  values (p_alumno_id, p_plan_id, 1, 1, 'activa', v_hoy)
  returning id into v_new;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- atender_solicitud: asigna el plan y marca la solicitud como atendida por el usuario actual.
-- ---------------------------------------------------------------------------
create function public.atender_solicitud(p_solicitud_id uuid, p_plan_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sol  public.solicitudes_ciclo%rowtype;
  v_asig uuid;
begin
  if not public.is_staff() then
    raise exception 'Solo el staff puede atender solicitudes' using errcode = '42501';
  end if;

  select * into v_sol
  from public.solicitudes_ciclo
  where id = p_solicitud_id and public.alumno_en_mi_gym(alumno_id)
  for update;
  if not found then
    raise exception 'La solicitud no existe' using errcode = 'P0002';
  end if;

  if v_sol.estado <> 'pendiente' then
    raise exception 'Esa solicitud ya fue atendida' using errcode = '22023';
  end if;

  v_asig := public.asignar_plan(v_sol.alumno_id, p_plan_id);

  update public.solicitudes_ciclo
  set estado = 'atendida', atendida_por = (select auth.uid())
  where id = p_solicitud_id;

  return v_asig;
end;
$$;

-- ---------------------------------------------------------------------------
-- duplicar_plan: clona un plan completo como plantilla nueva (sin alumno ni origen).
-- ---------------------------------------------------------------------------
create function public.duplicar_plan(p_plan_id uuid, p_nombre text, p_tipo text, p_nivel text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gym  uuid := public.current_gym_id();
  v_new  uuid;
  s      record;
begin
  if not public.is_staff() then
    raise exception 'Solo el staff puede duplicar planes' using errcode = '42501';
  end if;

  if btrim(coalesce(p_nombre, '')) = '' or btrim(coalesce(p_tipo, '')) = '' then
    raise exception 'El plan necesita nombre y tipo' using errcode = '22023';
  end if;

  if not exists (select 1 from public.planes where id = p_plan_id and gym_id = v_gym) then
    raise exception 'El plan no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  -- el trigger crea las 24 sesiones vacías
  insert into public.planes (gym_id, nombre, tipo, nivel)
  values (v_gym, btrim(p_nombre), btrim(p_tipo), nullif(btrim(coalesce(p_nivel, '')), ''))
  returning id into v_new;

  for s in
    select os.id as old_id, ns.id as new_id
    from public.sesiones os
    join public.sesiones ns
      on ns.plan_id = v_new and ns.semana = os.semana and ns.estimulo = os.estimulo
    where os.plan_id = p_plan_id
  loop
    perform public._clonar_bloques(s.old_id, s.new_id);
  end loop;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- copiar_semana: reemplaza todos los bloques de la semana destino con una copia de la origen.
-- Devuelve la cantidad de bloques copiados.
-- ---------------------------------------------------------------------------
create function public.copiar_semana(p_plan_id uuid, p_semana_origen int, p_semana_destino int)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_gym   uuid := public.current_gym_id();
  v_total int;
  s       record;
begin
  if not public.is_staff() then
    raise exception 'Solo el staff puede copiar semanas' using errcode = '42501';
  end if;

  if p_semana_origen not between 1 and 4 or p_semana_destino not between 1 and 4
     or p_semana_origen = p_semana_destino then
    raise exception 'Elegí dos semanas distintas, entre la 1 y la 4' using errcode = '22023';
  end if;

  if not exists (select 1 from public.planes where id = p_plan_id and gym_id = v_gym) then
    raise exception 'El plan no existe en tu gimnasio' using errcode = 'P0002';
  end if;

  delete from public.bloques
  where sesion_id in (
    select id from public.sesiones where plan_id = p_plan_id and semana = p_semana_destino
  );

  for s in
    select o.id as old_id, d.id as new_id
    from public.sesiones o
    join public.sesiones d
      on d.plan_id = o.plan_id and d.semana = p_semana_destino and d.estimulo = o.estimulo
    where o.plan_id = p_plan_id and o.semana = p_semana_origen
  loop
    perform public._clonar_bloques(s.old_id, s.new_id);
  end loop;

  select count(*) into v_total
  from public.bloques b
  join public.sesiones se on se.id = b.sesion_id
  where se.plan_id = p_plan_id and se.semana = p_semana_destino;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución (las funciones nuevas nacen con EXECUTE para PUBLIC)
-- ---------------------------------------------------------------------------
revoke execute on function
  public._clonar_bloques(uuid, uuid),
  public.asignar_plan(uuid, uuid),
  public.atender_solicitud(uuid, uuid),
  public.duplicar_plan(uuid, text, text, text),
  public.copiar_semana(uuid, int, int)
from public, anon, authenticated;

grant execute on function
  public.asignar_plan(uuid, uuid),
  public.atender_solicitud(uuid, uuid),
  public.duplicar_plan(uuid, text, text, text),
  public.copiar_semana(uuid, int, int)
to authenticated;
