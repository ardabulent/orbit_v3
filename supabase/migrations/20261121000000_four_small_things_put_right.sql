-- Ana plan 5.5 · Depo hijyeni (2026-10-25)
--
-- Dört küçük iş, tek göç:
--
-- 1. `exam_ranking(uuid)` kaldırılır. İstemci onu hiç çağırmadı (sınav
--    ekranları `exam_results`'ı RLS ile okur, sayı `exam_participant_count`).
--    Az katılımlı bir sınavda maskeli satırlar kimliği ele veriyordu: iki
--    kişilik sınavda öğrencinin görmediği tek satır, öbür öğrencidir.
--    Kullanılmayan bir sızıntı yüzeyi, kurallanmış bir sızıntı yüzeyinden
--    iyidir; sıralama bir gün istenirse en az üç katılımcı kuralıyla yeniden
--    tasarlanır. Görünürlük testleri `exam_results` üzerinden yeniden yazıldı.
--
-- 2. Giriş numarası tahsisindeki yarış. Kişi kodu "üyeliklerdeki en büyük + 1"
--    idi; tahsis ile üyeliğin yazılması arasında auth hesabı açılıyor. Aynı
--    anda iki üye açılırsa ikisi aynı kodu alıyor, ikincinin hesabı aynı
--    sentetik adrese çarpıp reddediliyordu (veri bozulmaz, kullanıcı hata
--    görür). Artık açılmış ama henüz üyeliği yazılmamış `<kurum><kişi>@orbit.invalid`
--    hesapları da sayılır; Edge tarafı çakışmada yeni kodla yeniden dener.
--
-- 3. `internal_lesson_minutes` kullanıcıya açıktı. Yalnız `security definer`
--    çakışma fonksiyonlarının içinden çağrılıyor; yetki kaldırıldı.
--
-- 4. `internal_my_membership_id` → `current_user_membership_id`. "internal_"
--    öneki bu depoda "kullanıcı çağıramaz" demek; bu fonksiyon iki RLS
--    politikasında kullanıcı bağlamında çalışmak ZORUNDA. Ad gerçeğe
--    uyduruldu (`current_user_*` ailesi); beş fonksiyon ve iki politika yeni
--    adı kullanır, eski ad kaldırılır.

-- 1 -------------------------------------------------------------------------
drop function public.exam_ranking(uuid);

-- 2 -------------------------------------------------------------------------
create or replace function public.internal_next_person_code(target_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  kurum_kodu integer;
  next_code integer;
begin
  select kurum.code into kurum_kodu
  from public.organizations as kurum
  where kurum.id = target_organization_id
  for update;

  if not found then
    raise exception 'organization does not exist' using errcode = '23503';
  end if;

  -- Üyelikteki en büyük kod ve açılmış ama üyeliği henüz yazılmamış hesap
  -- (tahsis → auth hesabı → üyelik sırasının ortası). İkincisi olmadan aynı
  -- anda açılan iki üye aynı kodu alıyordu.
  select greatest(
    coalesce((
      select max(uyelik.person_code)
      from public.organization_memberships as uyelik
      where uyelik.organization_id = target_organization_id
    ), 999),
    coalesce((
      select max(substring(hesap.email from 5 for 4)::integer)
      from auth.users as hesap
      where hesap.email like kurum_kodu::text || '____@orbit.invalid'
        and substring(hesap.email from 5 for 4) ~ '^[0-9]{4}$'
    ), 999)
  ) + 1
  into next_code;

  if next_code > 9999 then
    raise exception 'organization person code capacity exhausted'
      using errcode = '23514';
  end if;

  return next_code;
end;
$$;

revoke all on function public.internal_next_person_code(uuid)
  from public, anon, authenticated;

-- 3 -------------------------------------------------------------------------
revoke all on function public.internal_lesson_minutes(time, time)
  from public, anon, authenticated;

-- 4 -------------------------------------------------------------------------
create function public.current_user_membership_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select uyelik.id
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid()) and uyelik.status = 'active'
  order by uyelik.created_at
  limit 1;
$$;

comment on function public.current_user_membership_id() is
  'Çağıranın aktif üyeliği (en eskisi). Mesajlaşma politikaları ve RPC''leri kullanır. 2026-10-25''e kadar adı internal_my_membership_id idi.';

revoke all on function public.current_user_membership_id() from public, anon;
grant execute on function public.current_user_membership_id() to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_conversations()
 RETURNS TABLE(conversation_id uuid, other_membership_id uuid, other_name text, other_role app_role, last_message text, last_message_at timestamp with time zone, last_from_me boolean, unread boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ben as (select (select public.current_user_membership_id()) as id)
  select
    konusma.id,
    karsi.id,
    coalesce(nullif(btrim(profil.display_name), ''), 'Adsız üye'),
    karsi.role,
    son.body,
    konusma.last_message_at,
    son.sender_membership_id = ben.id,
    son.sender_membership_id <> ben.id
      and son.created_at > coalesce(
        case when konusma.member_low = ben.id then konusma.low_read_at else konusma.high_read_at end,
        '-infinity'::timestamptz)
  from ben
  join public.conversations as konusma
    on konusma.member_low = ben.id or konusma.member_high = ben.id
  join public.organization_memberships as karsi
    on karsi.id = case when konusma.member_low = ben.id then konusma.member_high else konusma.member_low end
  join public.profiles as profil on profil.id = karsi.user_id
  left join lateral (
    select mesaj.body, mesaj.sender_membership_id, mesaj.created_at
    from public.messages as mesaj
    where mesaj.conversation_id = konusma.id
    order by mesaj.created_at desc, mesaj.id desc
    limit 1
  ) as son on true
  where not (select public.current_user_must_change_password())
    and konusma.last_message_at is not null
  order by konusma.last_message_at desc
  limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.list_message_contacts()
 RETURNS TABLE(membership_id uuid, display_name text, role app_role, detail text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ben as (
    select uyelik.* from public.organization_memberships as uyelik
    where uyelik.id = (select public.current_user_membership_id())
  )
  select
    o.id,
    coalesce(nullif(btrim(profil.display_name), ''), 'Adsız üye'),
    o.role,
    case o.role
      when 'admin' then 'Kurum yönetimi'
      when 'teacher' then 'Öğretmen'
      when 'student' then (
        select string_agg(distinct sinif.name, ', ')
        from public.classes as sinif
        where sinif.id = any (public.internal_family_class_ids(o.id)))
      when 'parent' then (
        select 'Velisi: ' || string_agg(distinct ogrenci.full_name, ', ')
        from public.guardians as veli
        join public.student_guardians as bag on bag.guardian_id = veli.id and bag.archived_at is null
        join public.students as ogrenci on ogrenci.id = bag.student_id and ogrenci.archived_at is null
        where veli.auth_user_id = o.user_id and veli.organization_id = o.organization_id
          and veli.archived_at is null)
    end
  from ben
  join public.organization_memberships as o
    on o.organization_id = ben.organization_id and o.status = 'active' and o.id <> ben.id
  join public.profiles as profil on profil.id = o.user_id
  where not (select public.current_user_must_change_password())
    and public.internal_can_message(ben.id, o.id)
  order by 2;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(target_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ben uuid := public.current_user_membership_id();
begin
  update public.conversations
     set low_read_at = case when member_low = ben then now() else low_read_at end,
         high_read_at = case when member_high = ben then now() else high_read_at end
   where id = target_conversation_id and ben in (member_low, member_high);
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid()) and kind = 'message'
     and entity_id = target_conversation_id and read_at is null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_message(target_conversation_id uuid, message_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ben uuid := public.current_user_membership_id();
  konusma public.conversations;
  karsi uuid;
  karsi_kullanici uuid;
  benim_adim text;
  kimlik uuid;
begin
  if ben is null or (select public.current_user_must_change_password()) then
    raise exception 'Bu işlem için oturum açmanız gerekiyor.' using errcode = '42501';
  end if;
  -- Kötüye kullanım sınırı: dakikada en çok 30 mesaj.
  if (select count(*) from public.messages as mesaj
       where mesaj.sender_membership_id = ben
         and mesaj.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Çok hızlı mesaj gönderiyorsunuz; bir dakika sonra tekrar deneyin.'
      using errcode = '54000';
  end if;

  select * into konusma from public.conversations where id = target_conversation_id;
  if konusma.id is null or ben not in (konusma.member_low, konusma.member_high) then
    raise exception 'Konuşma bulunamadı.' using errcode = 'P0002';
  end if;
  karsi := case when konusma.member_low = ben then konusma.member_high else konusma.member_low end;
  if not public.internal_can_message(ben, karsi) then
    raise exception 'Bu kişiye artık mesaj gönderemezsiniz.'
      using errcode = '42501',
            hint = 'Öğretmen sınıftan ayrıldıysa ya da üyelik kapatıldıysa yazışma yalnız okunur.';
  end if;
  if message_body is null or char_length(btrim(message_body)) = 0 then
    raise exception 'Boş mesaj gönderilemez.' using errcode = '22023';
  end if;
  if char_length(btrim(message_body)) > 2000 then
    raise exception 'Mesaj en çok 2000 karakter olabilir.' using errcode = '22023';
  end if;

  insert into public.messages (organization_id, conversation_id, sender_membership_id, body)
  values (konusma.organization_id, konusma.id, ben, btrim(message_body))
  returning id into kimlik;

  update public.conversations
     set last_message_at = now(),
         low_read_at = case when member_low = ben then now() else low_read_at end,
         high_read_at = case when member_high = ben then now() else high_read_at end
   where id = konusma.id;

  select uyelik.user_id into karsi_kullanici from public.organization_memberships as uyelik where uyelik.id = karsi;
  select coalesce(nullif(btrim(profil.display_name), ''), 'Bir üye') into benim_adim
  from public.organization_memberships as uyelik
  join public.profiles as profil on profil.id = uyelik.user_id
  where uyelik.id = ben;

  -- Konuşma başına okunmamış tek mesaj bildirimi (sohbet akmaya devam eder).
  perform public.internal_notify(
    array[karsi_kullanici], konusma.organization_id, 'message',
    benim_adim || ' size yazdı',
    left(regexp_replace(btrim(message_body), '\s+', ' ', 'g'), 120),
    'İletişim', konusma.id);
  return kimlik;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_conversation(target_membership_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ben uuid := public.current_user_membership_id();
  kurum uuid;
  kimlik uuid;
begin
  if ben is null or (select public.current_user_must_change_password()) then
    raise exception 'Bu işlem için oturum açmanız gerekiyor.' using errcode = '42501';
  end if;
  if not public.internal_can_message(ben, target_membership_id) then
    raise exception 'Bu kişiye mesaj gönderemezsiniz.'
      using errcode = '42501',
            hint = 'Öğretmenler yalnız okuttukları sınıfların öğrencilerine ve velilerine yazabilir.';
  end if;
  select organization_id into kurum from public.organization_memberships where id = ben;

  insert into public.conversations (organization_id, member_low, member_high)
  values (kurum, least(ben, target_membership_id), greatest(ben, target_membership_id))
  on conflict (organization_id, member_low, member_high) do nothing;

  select konusma.id into kimlik
  from public.conversations as konusma
  where konusma.organization_id = kurum
    and konusma.member_low = least(ben, target_membership_id)
    and konusma.member_high = greatest(ben, target_membership_id);
  return kimlik;
end;
$function$
;

alter policy conversations_select_participant on public.conversations
  using (
    (
      member_low = (select public.current_user_membership_id())
      or member_high = (select public.current_user_membership_id())
    )
    and not (select public.current_user_must_change_password())
  );

alter policy messages_select_participant on public.messages
  using (
    exists (
      select 1
      from public.conversations as konusma
      where konusma.id = messages.conversation_id
        and (
          konusma.member_low = (select public.current_user_membership_id())
          or konusma.member_high = (select public.current_user_membership_id())
        )
    )
    and not (select public.current_user_must_change_password())
  );

drop function public.internal_my_membership_id();
