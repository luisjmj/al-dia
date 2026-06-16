# notify-due · Avisos de vencimiento (Web Push)

Envía dos recordatorios por deuda: **7 días antes** y **24 horas antes** del día
de pago. No avisa si la cuota ya está pagada o marcada "no se paga". Las deudas
compartidas avisan a ambos miembros del hogar; las personales, solo al dueño.

## Despliegue (una sola vez)

1. **Migraciones SQL** (Supabase → SQL Editor → Run, en orden):
   - `migration_007_push.sql` — tablas `push_subscriptions` y `notification_log`.
   - `migration_008_cron.sql` — programa el cron diario. Antes de correrla, pega
     tu `service_role_key` donde dice `PEGA_AQUI_TU_SERVICE_ROLE_KEY`.

2. **Secrets de la función** (VAPID). Genera el par una vez:
   ```bash
   npx web-push generate-vapid-keys
   ```
   La pública ya está en `.env.local` (`VITE_VAPID_PUBLIC_KEY`). Carga las tres:
   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=<publica> \
     VAPID_PRIVATE_KEY=<privada> \
     VAPID_SUBJECT=mailto:medinajluisj@gmail.com
   ```

3. **Deploy de la función** (no requiere JWT: la llama el cron):
   ```bash
   supabase functions deploy notify-due --no-verify-jwt
   ```

## Probar manualmente

```bash
curl -X POST https://tcowdwbepwrvossknyem.supabase.co/functions/v1/notify-due
```
Devuelve un JSON con cuántos push se enviaron. Para forzar un aviso de prueba:
crea una deuda con día de pago a 7 (o 1) días, suscríbete en Admin → Notificaciones,
y llama la función.

## Notas

- Hora: el cron corre a las **17:00 UTC = 12:00 PM Colombia** (UTC-5 fijo).
- Anti-duplicados: cada (deuda, mes, umbral) se registra en `notification_log`;
  reintentos el mismo día no reenvían.
- iOS solo recibe push si la PWA está **instalada** en la pantalla de inicio (iOS 16.4+).
