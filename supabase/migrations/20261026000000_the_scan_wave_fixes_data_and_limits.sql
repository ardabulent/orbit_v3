-- Tarama turunun veri ve yetki düzeltmeleri (2026-10-07/11).
--
-- ALLOW-DESTRUCTIVE: internal_begin_function_call aynen yeniden tanımlanıyor (yalnız üç fonksiyonun saatlik sınırı eklendi); gövdesindeki "delete from" 7 günden eski kapı defteri satırlarını ayıklayan mevcut satırdır, göç onu çalıştırmaz.
--
-- 1. "Yalnız öğretmenler" duyurusu (kullanıcı geri bildirimi, 2026-10-11):
--    `audience` dördüncü değer `staff` alır. Görünürlük kuralı
--    (`daily_feed_posts_audience`) yönetici ve öğretmene her duyuruyu zaten
--    gösteriyor, öğrenciye ve veliye yalnız kendi kitlesini; yani `staff`
--    için yeni politika gerekmez — öğrenci ve veli onu kural gereği görmez.
-- 2. Ödevin verildiği gün kurum saatiyle (B15): varsayılan `current_date`
--    UTC'ydi ve ekran bu alanı göndermiyor; 00:00–03:00 arasında verilen ödev
--    bir önceki güne düşüyordu.
-- 3. Öğrenci arşivlenince sınıf kayıtları da kapanır, geri alınınca açılır
--    (B19). Kapanış damgası öğrencininkiyle aynı; geri almada yalnız o
--    damgalı kayıtlar açılır, arada aynı sınıfa yeniden kaydedildiyse açılmaz.
--    Var olan tutarsız kayıtlar bir kez düzeltilir.
-- 4. Üç indekssiz yabancı anahtar: `exam_absences.organization_id` (kurum
--    ön süzgeci her okumada bu sütuna bakıyor), `client_error_reports.
--    organization_id`, `account_link_codes.consumed_by_user_id`.
-- 5. Hız sınırı (B9): hesap değiştirme 120, rol değiştirme ve üye çıkarma
--    60 / saat. Varsayılan 10 / saat'e düşüyorlardı.
-- 6. Canlı güncelleme yeni tablolara: Sınava girmedi, sınav bölümleri ve
--    netleri, vekil atamaları, ders programı şablonları.

-- 1 ---------------------------------------------------------------------------
alter table public.daily_feed_posts
  drop constraint daily_feed_posts_audience_check;
alter table public.daily_feed_posts
  add constraint daily_feed_posts_audience_check
  check (audience = any (array['all', 'guardians', 'students', 'staff']));

-- 2 ---------------------------------------------------------------------------
alter table public.homework_assignments
  alter column assigned_on set default public.orbit_today();

-- 3 ---------------------------------------------------------------------------
create function public.internal_student_archive_follows_enrollments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    update public.class_enrollments as kayit
       set archived_at = new.archived_at
     where kayit.student_id = new.id
       and kayit.archived_at is null;
  elsif old.archived_at is not null and new.archived_at is null then
    update public.class_enrollments as kayit
       set archived_at = null
     where kayit.student_id = new.id
       and kayit.archived_at = old.archived_at
       and not exists (
         select 1 from public.class_enrollments as etkin
         where etkin.student_id = kayit.student_id
           and etkin.class_id = kayit.class_id
           and etkin.archived_at is null
       );
  end if;
  return new;
end;
$$;

comment on function public.internal_student_archive_follows_enrollments() is
  'Öğrenci arşivlenince sınıf kayıtları aynı damgayla kapanır, geri alınınca yalnız o damgalı kayıtlar açılır (B19, 2026-10-11). security invoker: arşivleyen kişinin yetkisiyle çalışır.';

revoke all on function public.internal_student_archive_follows_enrollments()
  from public, anon, authenticated;

create trigger students_archive_follows_enrollments
  after update of archived_at on public.students
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function public.internal_student_archive_follows_enrollments();

-- Bir kerelik düzeltme: arşivdeki öğrencinin açık kalmış sınıf kayıtları.
update public.class_enrollments as kayit
   set archived_at = ogrenci.archived_at
  from public.students as ogrenci
 where ogrenci.id = kayit.student_id
   and ogrenci.archived_at is not null
   and kayit.archived_at is null;

-- 4 ---------------------------------------------------------------------------
create index exam_absences_organization_idx
  on public.exam_absences (organization_id);
create index client_error_reports_organization_idx
  on public.client_error_reports (organization_id);
create index account_link_codes_consumed_by_idx
  on public.account_link_codes (consumed_by_user_id);

-- 6 ---------------------------------------------------------------------------
do $$
declare
  tablo text;
begin
  foreach tablo in array array[
    'exam_absences', 'exam_sections', 'exam_section_results',
    'substitute_assignments', 'schedule_templates', 'schedule_template_slots'
  ] loop
    execute format(
      'create trigger %1$s_broadcast_insert after insert on public.%1$I
         referencing new table as changed_rows for each statement
         execute function public.broadcast_organization_change()', tablo);
    execute format(
      'create trigger %1$s_broadcast_update after update on public.%1$I
         referencing new table as changed_rows for each statement
         execute function public.broadcast_organization_change()', tablo);
    execute format(
      'create trigger %1$s_broadcast_delete after delete on public.%1$I
         referencing old table as changed_rows for each statement
         execute function public.broadcast_organization_change()', tablo);
  end loop;
end;
$$;

-- 5 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_begin_function_call(function_slug text, caller_user_id uuid, idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  saatlik_sinir integer;
  mevcut public.internal_function_calls%rowtype;
  pencere_sayisi integer;
  yeni_id bigint;
begin
  -- 🔴 Çağıranın şifre kilidi (2026-10-03, v1.5-20). Bütün Edge
  -- fonksiyonları işe başlamadan bu kapıdan geçer; kilit burada durursa sekiz
  -- fonksiyonun sekizi de kapanır. Ölçüldü: kilitli bir yönetici normal
  -- ekranlarda hiçbir şey okuyamazken üye açabiliyor, rol değiştirebiliyor,
  -- üye çıkarabiliyor ve şifre sıfırlayabiliyordu. İfade
  -- `current_user_must_change_password()` ve `internal_begin_account_switch`
  -- ile aynı: süresi dolmuş geçici şifre de kilittir. Hız sınırından ve tekrar
  -- korumasından ÖNCE: kilitli çağıran bir tekrarın sonucunu da alamaz.
  if exists (
    select 1 from public.profiles as cagiran
    where cagiran.id = internal_begin_function_call.caller_user_id
      and (
        cagiran.must_change_password
        or (cagiran.password_expires_at is not null
            and cagiran.password_expires_at <= now())
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'password_locked');
  end if;
  saatlik_sinir := case internal_begin_function_call.function_slug
    when 'create-member' then 60
    when 'reset-member-password' then 30
    when 'reset-admin-password' then 30
    when 'bootstrap-organization' then 10
    when 'delete-organization' then 5
    -- Hesap değiştirme, rol değiştirme ve üye çıkarma (2026-10-07, B9):
    -- bunlar varsayılan 10/saat'e düşüyordu; hem veli hem öğretmen olan biri
    -- gün içinde 11. hesap değişiminde reddediliyordu (ölçüldü, §4.23 B9).
    when 'switch-account' then 120
    when 'change-member-role' then 60
    when 'remove-member' then 60
    -- Tanınmayan bir slug sessizce sınırsız kalmamalı (K-04).
    else 10
  end;

  -- Ayıklama: yalnızca bu çağıranın bu fonksiyona ait eski satırları.
  delete from public.internal_function_calls as eski
  where eski.caller_user_id = internal_begin_function_call.caller_user_id
    and eski.function_slug = internal_begin_function_call.function_slug
    and eski.created_at < now() - interval '7 days';

  if internal_begin_function_call.idempotency_key is not null then
    select * into mevcut
    from public.internal_function_calls as kayit
    where kayit.function_slug = internal_begin_function_call.function_slug
      and kayit.caller_user_id = internal_begin_function_call.caller_user_id
      and kayit.idempotency_key = internal_begin_function_call.idempotency_key;

    if found then
      if mevcut.completed_at is not null then
        return jsonb_build_object(
          'allowed', false, 'reason', 'replay', 'outcome', mevcut.outcome
        );
      end if;

      -- Aynı anahtarla eşzamanlı ikinci istek. İşi tekrar yapmak yerine
      -- çağıranı bekletmek doğru: birincisi bitince tekrar sorabilir.
      return jsonb_build_object('allowed', false, 'reason', 'in_progress');
    end if;
  end if;

  select count(*) into pencere_sayisi
  from public.internal_function_calls as kayit
  where kayit.caller_user_id = internal_begin_function_call.caller_user_id
    and kayit.function_slug = internal_begin_function_call.function_slug
    and kayit.created_at > now() - interval '1 hour';

  if pencere_sayisi >= saatlik_sinir then
    return jsonb_build_object(
      'allowed', false, 'reason', 'rate_limited', 'limit', saatlik_sinir
    );
  end if;

  insert into public.internal_function_calls (
    function_slug, caller_user_id, idempotency_key
  )
  values (
    internal_begin_function_call.function_slug,
    internal_begin_function_call.caller_user_id,
    internal_begin_function_call.idempotency_key
  )
  -- Yarış: aynı anahtarla iki istek yukarıdaki okumayı birlikte geçebilir.
  -- Benzersiz indeks birini eler; elenen taraf işi yapmaz.
  on conflict do nothing
  returning id into yeni_id;

  if yeni_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'in_progress');
  end if;

  return jsonb_build_object('allowed', true, 'call_id', yeni_id);
end;
$function$;
