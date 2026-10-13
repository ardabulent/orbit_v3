-- Yeni mesaj, okunmamış mesaj bildirimini tazeler (2026-10-13; göç
-- 20261031000000'ın tarayıcı denemesinde bulundu).
--
-- Konuşma başına okunmamış tek mesaj bildirimi tutulur
-- (`notifications_unread_once_idx`). `internal_notify` çakışmada hiçbir şey
-- yapmıyordu: veli üst üste yazınca öğretmenin zili İLK mesajın metnini ve
-- saatini göstermeye devam ediyordu ("21 sa önce", oysa son mesaj şimdi geldi).
--
-- Artık mesaj bildirimi çakışınca başlığı, metni ve saati son mesajla
-- güncellenir. Diğer türler (duyuru, ödev, sınav sonucu, devamsızlık) aynen
-- kalır: bir sınav sonucunun bölüm bölüm kaydı bildirimi tekrar tekrar öne
-- çekmemeli.

create or replace function public.internal_notify(
  target_user_ids uuid[],
  target_organization_id uuid,
  target_kind text,
  target_title text,
  target_body text,
  target_section text,
  target_entity_id uuid,
  except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kisi uuid;
begin
  insert into public.notifications (organization_id, user_id, kind, title, body, section, entity_id)
  select target_organization_id, alici, target_kind, left(target_title, 160),
         left(target_body, 200), target_section, target_entity_id
  from (select distinct unnest(target_user_ids) as alici) as alicilar
  where alici is not null and alici is distinct from except_user_id
  on conflict (user_id, kind, entity_id) where read_at is null and entity_id is not null
  do update set title = excluded.title,
                body = excluded.body,
                created_at = now()
  where public.notifications.kind = 'message';

  -- Kişiye özel dürtme; veri taşımaz, istemci kendi bildirimlerini okur.
  foreach kisi in array coalesce(target_user_ids, '{}'::uuid[]) loop
    if kisi is not null and kisi is distinct from except_user_id then
      perform realtime.send(
        jsonb_build_object('kind', target_kind), 'notify', 'user:' || kisi::text, true);
    end if;
  end loop;
end;
$$;

revoke all on function public.internal_notify(uuid[], uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
