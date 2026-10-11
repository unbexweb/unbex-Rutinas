# Unbex Rutinas — Especificación para desarrollo

> Fuente de verdad del alcance acordado con el cliente (doc "Unbex App de Rutinas — Alcances", rev. 10/10/2026).
> Pensado para usar como contexto en Claude Code. Copy de la app en español rioplatense (voseo).

## 1. Qué es

App web (PWA, mobile-first) que reemplaza las planillas de Drive de musculación de Unbex.
Profes o administración cargan planes (generales o personalizados) y los asignan a alumnos.
El alumno sigue su rutina desde el celular en el gimnasio, anota los pesos que usó y ve qué hizo y qué le falta.

## 2. Stack y convenciones

- Next.js 15 (App Router) + React 19, deploy en Vercel.
- Supabase: Auth + Postgres + RLS. Plan free.
- **Siempre `pnpm`, nunca `npm install`.** Versiones exactas, `--frozen-lockfile` en CI.
- App separada del sitio institucional (sugerido: `app.unbex.com.ar`).
- Marca (reusar del sitio unbex-web): `--color-violeta: #4B2556`, `--color-rosa: #FDE3D8`, Montserrat. Colores y fuentes siempre por variables CSS, nunca hardcodeados.
- PWA instalable (manifest + service worker), sin tiendas.

## 3. Roles

| Rol | Permisos |
| --- | --- |
| `admin` | **Todo lo que hace un profe** + gestionar profes (alta/edición/baja) + aprobar altas |
| `profe` | Ve a todos los alumnos del gym. Crea/edita planes, asigna, personaliza, ve progreso y ficha de salud, gestiona biblioteca, aprueba altas |
| `alumno` | Ve sus planes, hace entrenamientos, registra cargas, solicita próximo ciclo |

En RLS: `admin` hereda todas las políticas de `profe`. Todo filtrado por `gym_id`.

## 4. Funcionalidades — Alumno

1. **Alta**: autoregistro (queda `pendiente` hasta que profe/admin lo aprueba) o alta hecha por el gym.
2. **Login con email O DNI + contraseña.** Si ingresa DNI, una función server-side busca el email asociado y hace `signInWithPassword`. Sesión persistente.
3. **Pantalla inicio**: deja claro cuál toca hoy ("Semana 2 · Estímulo 3") con un botón grande para empezar.
4. **Vista del plan completo**: puede ver los 24 entrenamientos — los ya hechos (con lo que registró) y los que siguen — con el de hoy destacado.
5. **Entrenamiento ejercicio por ejercicio**, desde el primer bloque hasta el último. Botones y letra grandes.
6. **Video de cada ejercicio** (YouTube embebido).
7. Se muestran **series, repeticiones y peso sugerido tal como los carga el profe** (sin traducir notación: "3x8/10", "6/6", etc.).
8. **Registrar peso y repeticiones por serie.** La app **muestra el peso que usó la vez anterior** en ese ejercicio como referencia.
9. **Elegir alternativa** cuando el ejercicio la tiene ("Pull Ups ó Dorsalera").
10. **Marcar entrenamiento como hecho** → avanza al siguiente y muestra progreso ("3 de 24").
11. **Al terminar S4·E6: solicitar el próximo ciclo desde la app**, eligiendo tipo (Volumen / Definición / …) y con un campo de texto libre para anotaciones. NO hay reinicio automático: el profe/admin atiende la solicitud y asigna el nuevo plan.
12. **Ficha de salud opcional** (lesiones, medicación, suplementos, cirugías, alcohol, tabaco, plan nutricional, actividad laboral, actividad física actual). Sin apto médico ni consentimiento.

## 5. Funcionalidades — Profe / Admin

1. Crear y editar planes (Volumen, Definición y los que se sumen) en una **grilla tipo planilla, estímulos como columnas**.
2. Asignar un plan a un alumno y cambiárselo.
3. Personalizar el plan de un alumno puntual sin tocar la plantilla general.
4. Corregir un plan general una vez → impacta en todos los alumnos que lo tienen sin personalizar.
5. Ver progreso por alumno: por dónde va, entrenamientos hechos, pesos usados.
6. Ver ficha de salud (solo profe/admin).
7. Dar de alta alumnos / aprobar autoregistros.
8. Gestionar biblioteca de ejercicios.
9. **Ver y atender solicitudes de próximo ciclo.**
10. Solo admin: gestionar profes.

## 6. Estructura de planes

- Fija: **4 semanas × 6 estímulos = 24 sesiones** por plan (constraint en DB).
- Las **secciones/bloques de cada sesión son libres**: las define quien arma el plan (ej. "Movilidad", "Activación", "Bloque 1", "Opcional Nenas"). No hay lista fija.
- Cada semana puede variar (series, descarga, ejercicios).
- El alumno hace las 24 sesiones en orden, a su ritmo, sin saltear.
- Super series: solo texto de indicación en el bloque, sin estructura propia.

## 7. Biblioteca de ejercicios

- Por gym. Nombre, video (YouTube), descripción corta opcional.
- Videos: grabados por el gym (subidos como "no listados") **o videos públicos ya existentes en YouTube**. Guardar la URL y extraer el ID para embeber.
- Cambiar el video de un ejercicio impacta en todos los planes que lo usan.

## 8. Modelo de datos

```
gyms
  id, nombre, slug

profiles                      -- 1:1 con auth.users
  id, gym_id → gyms
  rol (admin | profe | alumno)
  nombre, apellido
  dni UNIQUE, email UNIQUE
  estado (pendiente | activo | inactivo)

fichas_salud                  -- 1:1 con alumno, opcional; RLS: alumno dueño + profe/admin
  alumno_id → profiles (PK)
  lesiones, medicacion, suplementos, cirugias, alcohol, tabaco,
  plan_nutricional, actividad_laboral, actividad_fisica_actual,
  updated_at

ejercicios
  id, gym_id → gyms
  nombre, video_url, youtube_id, descripcion, activo

planes
  id, gym_id → gyms
  nombre, tipo (volumen | definicion | ...), nivel
  alumno_id → profiles NULL   -- NULL = plantilla general
  origen_id → planes NULL     -- plantilla de la que salió la personalizada

sesiones                      -- 24 creadas automáticamente al crear el plan
  id, plan_id → planes
  semana CHECK 1..4, estimulo CHECK 1..6
  UNIQUE (plan_id, semana, estimulo)

bloques
  id, sesion_id → sesiones, orden
  nombre, indicacion          -- texto libre

bloque_ejercicios
  id, bloque_id → bloques, orden
  ejercicio_id → ejercicios
  alternativa_id → ejercicios NULL
  series, reps (texto tal cual), carga_sugerida (texto), registra_carga bool, nota

asignaciones
  id, alumno_id → profiles, plan_id → planes
  semana_actual, estimulo_actual
  estado (activa | finalizada), fecha_inicio, fecha_fin
  -- una sola activa por alumno (unique parcial)

registros_sesion
  id, asignacion_id → asignaciones, sesion_id → sesiones
  fecha, completada

registros_series
  id, registro_id → registros_sesion
  bloque_ejercicio_id → bloque_ejercicios
  ejercicio_usado_id → ejercicios   -- si eligió la alternativa
  n_serie, peso, reps

solicitudes_ciclo
  id, alumno_id → profiles, asignacion_id → asignaciones
  tipo_solicitado (volumen | definicion | ...)
  nota (texto libre)
  estado (pendiente | atendida), atendida_por → profiles, created_at
```

**Lógica clave**
- "Peso de la vez anterior": último `registros_series.peso` del alumno para ese `ejercicio_id` (no por `bloque_ejercicio_id`, para que sirva entre planes).
- Personalizar: clonar plan completo (sesiones → bloques → bloque_ejercicios) con `alumno_id` y `origen_id`, y repuntar la asignación.
- Al completar S4·E6: `asignacion.estado = finalizada` y la UI ofrece crear `solicitud_ciclo`.

## 9. Fuera de alcance (no prometido al cliente)

- Gráficos de progreso (los datos se guardan desde el día 1).
- Cálculo de peso por % de máximo.
- Bloqueo por cuota.
- Notificaciones.
- Publicación en tiendas.
