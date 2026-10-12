# Pendientes

- [ ] URGENTE antes de datos reales o deploy: la service role key legacy quedó expuesta en GitHub (commit 49faa1e). Migrar a publishable/secret keys de Supabase, actualizar .env.local y deshabilitar las JWT legacy keys.
- [ ] Reemplazar los íconos provisorios de la PWA (una "U" rosa sobre violeta) por el logo real: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (el logo tiene que quedar dentro del 80% central), `apple-touch-icon.png` (180×180) e `icon.svg`.
- [ ] Borrar los usuarios de prueba antes de cargar datos reales: `alumno.prueba@unbex.test` (DNI 99000001) y `admin.prueba@unbex.test` (DNI 99000002). Antes, crear el admin real con `pnpm tsx --env-file=.env.local scripts/crear-admin.ts <email> <dni> <nombre> <apellido>`.
- [ ] Revisar el plan "Definición": se creó como copia exacta de Volumen. Hay que cargarle el contenido real.
- [ ] Mail de Supabase: el servicio de mails que viene por defecto tiene un límite muy bajo (unos pocos mails por hora). Para recuperar contraseña con más de un puñado de alumnos hace falta configurar un SMTP propio en Supabase → Authentication → SMTP Settings.
- [ ] Opcional, endurecer la CSP: hoy `script-src` lleva `'unsafe-inline'` porque Next.js inyecta scripts inline y las páginas estáticas no admiten nonce. Se puede pasar a nonces por request (middleware) si algún día hace falta.
