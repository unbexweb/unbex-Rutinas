-- Unbex Rutinas · Fase 1 · Enums y tablas (SPEC sección 8)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.rol as enum ('admin', 'profe', 'alumno');
create type public.estado_usuario as enum ('pendiente', 'activo', 'inactivo');
create type public.estado_asignacion as enum ('activa', 'finalizada');
create type public.estado_solicitud as enum ('pendiente', 'atendida');

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- gyms
-- ---------------------------------------------------------------------------
create table public.gyms (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  gym_id     uuid not null references public.gyms (id),
  rol        public.rol not null default 'alumno',
  nombre     text not null,
  apellido   text not null,
  dni        text not null unique,
  email      text not null unique,
  estado     public.estado_usuario not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_dni_solo_digitos check (dni ~ '^[0-9]+$')
);
create index profiles_gym_id_idx on public.profiles (gym_id);

-- ---------------------------------------------------------------------------
-- fichas_salud (1:1 con alumno, opcional)
-- ---------------------------------------------------------------------------
create table public.fichas_salud (
  alumno_id                uuid primary key references public.profiles (id) on delete cascade,
  lesiones                 text,
  medicacion               text,
  suplementos              text,
  cirugias                 text,
  alcohol                  text,
  tabaco                   text,
  plan_nutricional         text,
  actividad_laboral        text,
  actividad_fisica_actual  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ejercicios (biblioteca por gym)
-- ---------------------------------------------------------------------------
create table public.ejercicios (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id),
  nombre      text not null,
  video_url   text,
  youtube_id  text,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index ejercicios_gym_id_idx on public.ejercicios (gym_id);
create unique index ejercicios_gym_nombre_uq on public.ejercicios (gym_id, lower(nombre));

-- ---------------------------------------------------------------------------
-- planes (alumno_id NULL = plantilla general)
-- ---------------------------------------------------------------------------
create table public.planes (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id),
  nombre     text not null,
  tipo       text not null,          -- text y no enum: se pueden sumar tipos sin migración
  nivel      text,
  alumno_id  uuid references public.profiles (id) on delete cascade,
  origen_id  uuid references public.planes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planes_gym_id_idx    on public.planes (gym_id);
create index planes_alumno_id_idx on public.planes (alumno_id);
create index planes_origen_id_idx on public.planes (origen_id);

-- ---------------------------------------------------------------------------
-- sesiones (24 por plan, creadas por trigger)
-- ---------------------------------------------------------------------------
create table public.sesiones (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.planes (id) on delete cascade,
  semana     smallint not null,
  estimulo   smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sesiones_semana_rango   check (semana   between 1 and 4),
  constraint sesiones_estimulo_rango check (estimulo between 1 and 6),
  constraint sesiones_plan_semana_estimulo_uq unique (plan_id, semana, estimulo)
);
create index sesiones_plan_id_idx on public.sesiones (plan_id);

-- ---------------------------------------------------------------------------
-- bloques (secciones libres de una sesión)
-- ---------------------------------------------------------------------------
create table public.bloques (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.sesiones (id) on delete cascade,
  orden      integer not null,
  nombre     text not null,
  indicacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bloques_sesion_id_idx on public.bloques (sesion_id);

-- ---------------------------------------------------------------------------
-- bloque_ejercicios
-- ---------------------------------------------------------------------------
create table public.bloque_ejercicios (
  id             uuid primary key default gen_random_uuid(),
  bloque_id      uuid not null references public.bloques (id) on delete cascade,
  orden          integer not null,
  ejercicio_id   uuid not null references public.ejercicios (id),
  alternativa_id uuid references public.ejercicios (id),
  series         text,
  reps           text,              -- texto tal cual lo carga el profe ("8/10", "20""", "6/6")
  carga_sugerida text,
  registra_carga boolean not null default true,
  nota           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bloque_ejercicios_bloque_id_idx      on public.bloque_ejercicios (bloque_id);
create index bloque_ejercicios_ejercicio_id_idx   on public.bloque_ejercicios (ejercicio_id);
create index bloque_ejercicios_alternativa_id_idx on public.bloque_ejercicios (alternativa_id);

-- ---------------------------------------------------------------------------
-- asignaciones
-- ---------------------------------------------------------------------------
create table public.asignaciones (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid not null references public.profiles (id) on delete cascade,
  plan_id         uuid not null references public.planes (id),
  semana_actual   smallint not null default 1,
  estimulo_actual smallint not null default 1,
  estado          public.estado_asignacion not null default 'activa',
  fecha_inicio    date not null default current_date,
  fecha_fin       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint asignaciones_semana_rango   check (semana_actual   between 1 and 4),
  constraint asignaciones_estimulo_rango check (estimulo_actual between 1 and 6)
);
create index asignaciones_alumno_id_idx on public.asignaciones (alumno_id);
create index asignaciones_plan_id_idx   on public.asignaciones (plan_id);
-- una sola asignación activa por alumno
create unique index asignaciones_una_activa_por_alumno_uq
  on public.asignaciones (alumno_id) where estado = 'activa';

-- ---------------------------------------------------------------------------
-- registros_sesion
-- ---------------------------------------------------------------------------
create table public.registros_sesion (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.asignaciones (id) on delete cascade,
  sesion_id     uuid not null references public.sesiones (id),
  fecha         date not null default current_date,
  completada    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint registros_sesion_asignacion_sesion_uq unique (asignacion_id, sesion_id)
);
create index registros_sesion_asignacion_id_idx on public.registros_sesion (asignacion_id);
create index registros_sesion_sesion_id_idx     on public.registros_sesion (sesion_id);

-- ---------------------------------------------------------------------------
-- registros_series
-- ---------------------------------------------------------------------------
create table public.registros_series (
  id                  uuid primary key default gen_random_uuid(),
  registro_id         uuid not null references public.registros_sesion (id) on delete cascade,
  -- nullable: si se borra el bloque_ejercicio la serie queda (el historial se conserva
  -- por ejercicio_usado_id). Al crear, la política del alumno exige que no sea nulo.
  bloque_ejercicio_id uuid references public.bloque_ejercicios (id) on delete set null,
  ejercicio_usado_id  uuid not null references public.ejercicios (id),  -- el ejercicio o su alternativa
  n_serie             smallint not null,
  peso                numeric(7, 2),
  reps                integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint registros_series_n_serie_pos check (n_serie >= 1),
  constraint registros_series_peso_pos    check (peso is null or peso >= 0),
  constraint registros_series_reps_pos    check (reps is null or reps >= 0),
  constraint registros_series_serie_uq unique (registro_id, bloque_ejercicio_id, n_serie)
);
create index registros_series_registro_id_idx         on public.registros_series (registro_id);
create index registros_series_bloque_ejercicio_id_idx on public.registros_series (bloque_ejercicio_id);
-- soporta "peso de la vez anterior" por ejercicio
create index registros_series_ejercicio_usado_id_idx  on public.registros_series (ejercicio_usado_id, created_at desc);

-- ---------------------------------------------------------------------------
-- solicitudes_ciclo
-- ---------------------------------------------------------------------------
create table public.solicitudes_ciclo (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid not null references public.profiles (id) on delete cascade,
  asignacion_id   uuid not null references public.asignaciones (id) on delete cascade,
  tipo_solicitado text not null,
  nota            text,
  estado          public.estado_solicitud not null default 'pendiente',
  atendida_por    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index solicitudes_ciclo_alumno_id_idx     on public.solicitudes_ciclo (alumno_id);
create index solicitudes_ciclo_asignacion_id_idx on public.solicitudes_ciclo (asignacion_id);
create index solicitudes_ciclo_atendida_por_idx  on public.solicitudes_ciclo (atendida_por);

-- ---------------------------------------------------------------------------
-- Triggers updated_at en todas las tablas
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'gyms', 'profiles', 'fichas_salud', 'ejercicios', 'planes', 'sesiones',
    'bloques', 'bloque_ejercicios', 'asignaciones', 'registros_sesion',
    'registros_series', 'solicitudes_ciclo'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
