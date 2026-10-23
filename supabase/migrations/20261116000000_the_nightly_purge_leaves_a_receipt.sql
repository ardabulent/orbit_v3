-- Gece temizliği ne sildiğini kayda yazar (2026-10-23, ana plan 2.3/2.14).
--
-- `internal_purge_expired_records()` silinen sayıları döndürüyordu ama
-- `pg_cron` dönüş değerini saklamıyor (`cron.job_run_details` yalnız
-- "1 row" der). Yani silme izsiz kalıyordu. Artık bir şey silinen gece
-- platform denetim kaydına `platform.retention_purged` satırı düşer:
-- yalnız tablo başına sayılar, silinen içerik değil. Operatör panelinde
-- "Saklama süresi dolan kayıtlar silindi" diye görünür.

CREATE OR REPLACE FUNCTION public.internal_purge_expired_records()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sinir constant timestamptz := now() - interval '30 days';
  mesaj bigint;
  bildirim bigint;
  sohbet bigint;
  hata bigint;
  posta bigint;
  ozet jsonb;
begin
  delete from public.messages where created_at < sinir;
  get diagnostics mesaj = row_count;

  delete from public.notifications where kind = 'message' and created_at < sinir;
  get diagnostics bildirim = row_count;

  -- Son mesajı 30 günden eski (yani hiç mesajı kalmamış) sohbet; hiç mesaj
  -- yazılmamışsa açılış günü sayılır.
  delete from public.conversations as konusma
  where coalesce(konusma.last_message_at, konusma.created_at) < sinir
    and not exists (
      select 1 from public.messages as kalan where kalan.conversation_id = konusma.id
    );
  get diagnostics sohbet = row_count;

  delete from public.client_error_reports where created_at < sinir;
  get diagnostics hata = row_count;

  delete from public.email_deliveries where created_at < sinir;
  get diagnostics posta = row_count;

  ozet := jsonb_build_object(
    'messages', mesaj,
    'message_notifications', bildirim,
    'conversations', sohbet,
    'client_error_reports', hata,
    'email_deliveries', posta
  );

  -- Bir şey silindiyse ne kadar silindiği kalıcı olarak yazılır (yalnız
  -- sayılar; içerik değil). Hiçbir şey silinmeyen gece satır yazmaz.
  if mesaj + bildirim + sohbet + hata + posta > 0 then
    insert into public.platform_audit_events (actor_user_id, action, entity_type, metadata)
    values (null, 'platform.retention_purged', 'retention', ozet);
  end if;

  return ozet;
end;
$function$;
