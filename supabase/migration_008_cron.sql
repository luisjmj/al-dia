-- =====================================================================
--  Migración 008 · Cron diario que dispara la Edge Function notify-due
--  Corre todos los días a las 17:00 UTC = 12:00 PM Colombia.
--  Requiere las extensiones pg_cron y pg_net (Supabase → Database → Extensions).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda el service_role key en Vault (una sola vez). Reemplaza el valor.
-- Usa vault.create_secret (insertar directo en vault.secrets da
-- "permission denied for function _crypto_aead_det_noncegen").
-- Si ya existe, actualízalo con vault.update_secret(<id>, 'NUEVO_VALOR').
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    perform vault.create_secret('PEGA_AQUI_TU_SERVICE_ROLE_KEY', 'service_role_key');
  end if;
end $$;

-- (Re)programa el job.
select cron.unschedule('notify-due-daily')
  where exists (select 1 from cron.job where jobname = 'notify-due-daily');

select cron.schedule(
  'notify-due-daily',
  '0 17 * * *',                       -- 17:00 UTC = 12:00 PM COL
  $$
  select net.http_post(
    url     := 'https://tcowdwbepwrvossknyem.supabase.co/functions/v1/notify-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
