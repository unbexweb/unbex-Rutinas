# Pruebas manuales — Fase 2 (autenticación y roles)

Antes de empezar: `pnpm dev` y abrir http://localhost:3000 (mejor desde el celu o con el modo móvil del navegador). Necesitás `.env.local` con las claves de Supabase y `GYM_SLUG=unbex`.

Para el primer admin y las aprobaciones se usa el SQL Editor de Supabase (o `pnpm supabase db query --linked "..."`).

## 1. Sin sesión
- [ ] Entrar a `/` te lleva a `/login`.
- [ ] Entrar a `/inicio`, `/panel`, `/pendiente` y `/nueva-contrasena` te lleva a `/login`.

## 2. Registro
- [ ] En `/registro`, enviar con campos vacíos o una contraseña de menos de 8 caracteres muestra los errores debajo de cada campo.
- [ ] Un DNI con menos de 7 o más de 8 números muestra "El DNI tiene que tener 7 u 8 números".
- [ ] Registrar un alumno de prueba (DNI de 8 números, email real o de prueba, contraseña de 8+).
- [ ] Después del registro llegás a `/pendiente` con el mensaje "Tu cuenta está pendiente de aprobación. Avisale a tu profe."
  - Si el proyecto de Supabase exige confirmar el mail, en cambio ves "Te mandamos un mail para confirmar tu cuenta". Confirmalo y seguí con el punto 3.
- [ ] Registrar otra cuenta con el mismo DNI muestra "Ya hay una cuenta con ese DNI". Con el mismo email, "Ya hay una cuenta con ese email".

## 3. Pendiente y aprobación por SQL
- [ ] Con la cuenta pendiente, entrar a `/inicio` o `/panel` te devuelve a `/pendiente`.
- [ ] "Cerrar sesión" en `/pendiente` te lleva a `/login`.
- [ ] Aprobar al alumno:
  ```sql
  update public.profiles set estado = 'activo' where dni = 'DNI_DE_PRUEBA';
  ```
- [ ] Volver a entrar: ahora llegás a `/inicio` con "¡Hola, <nombre>!".

## 4. Login
- [ ] Con **email** y contraseña correctos entrás a `/inicio`.
- [ ] Cerrar sesión y entrar con el **DNI** (con y sin puntos, ej. `12.345.678`) y la contraseña: también entra.
- [ ] **DNI inexistente** + cualquier contraseña muestra "DNI, email o contraseña incorrectos".
- [ ] **DNI existente + contraseña mal** muestra exactamente el mismo mensaje (no se puede distinguir de la anterior).
- [ ] Un email que no existe muestra el mismo mensaje.
- [ ] Con sesión iniciada, entrar a `/login`, `/registro` o `/recuperar` te redirige a `/inicio`.
- [ ] Cerrar la pestaña, volver a abrir la app: la sesión sigue.

## 5. Roles
- [ ] Con el alumno activo, entrar a `/panel` te devuelve a `/inicio`.
- [ ] Promover a un usuario de prueba a profe:
  ```sql
  update public.profiles set rol = 'profe', estado = 'activo' where dni = 'DNI_PROFE';
  ```
  Al entrar va a `/panel`, y si intenta `/inicio` vuelve a `/panel`.
- [ ] Pasar a un alumno a `inactivo` (`update public.profiles set estado = 'inactivo' ...`): al entrar ve `/inactivo` con "Tu cuenta está inactiva. Consultá en recepción." y puede cerrar sesión.

## 6. Recuperar contraseña
- [ ] En `/recuperar`, con un email real de una cuenta: aparece "Si la cuenta existe, te mandamos un mail…" y llega el mail.
- [ ] Con un email o DNI que no existe, aparece **el mismo mensaje**.
- [ ] El link del mail abre `/nueva-contrasena` con sesión.
  - Si el link te lleva a otro dominio (ej. la URL de producción) en vez de localhost, agregá `http://localhost:3000/auth/callback` en Supabase → Authentication → URL Configuration → Redirect URLs.
- [ ] Contraseñas distintas o de menos de 8 caracteres muestran error.
- [ ] Guardar una contraseña válida te lleva a tu pantalla (`/inicio` o `/panel`), y podés entrar con la nueva.
- [ ] Abrir `/auth/callback?next=//ejemplo.com` sin código te manda a `/login` (no a otro sitio).

## 7. Cerrar sesión
- [ ] El botón "Cerrar sesión" está en `/inicio`, `/panel`, `/pendiente` e `/inactivo` y lleva a `/login`.
- [ ] Después de cerrar sesión, el botón "atrás" no te deja ver `/inicio` (te manda a `/login`).

## 8. Aspecto
- [ ] En celular los botones e inputs se ven grandes (48 px o más), con etiquetas visibles encima de cada campo.
- [ ] El teclado del DNI es numérico.
- [ ] Al enviar, el botón dice "Un momento…" y no se puede tocar de nuevo.
