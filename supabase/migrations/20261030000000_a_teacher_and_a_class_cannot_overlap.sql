-- Öğretmen ve sınıf aynı anda iki derste olamaz — saatler kesişiyorsa da
-- (2026-10-12, kullanıcı isteği; ROADMAP v1.5-15'in açık kalan maddesi).
--
-- `schedule_entries_class_slot_idx` ve `schedule_entries_teacher_slot_idx`
-- kısmi tekil indeksleri yalnız AYNI BAŞLANGIÇ saatini yakalıyordu: 09:00–09:40
-- ile 09:20–10:00 aynı öğretmene ya da aynı sınıfa yazılabiliyordu. Derslik
-- için süre kesişmesine bakan kural göç 20261029000000'da geldi; bu göç aynı
-- kuralı sınıfa ve öğretmene uygular ve sebebi söyler:
--   "12-A bu saatte başka bir derste: Pazartesi günü 09:00–09:40 arası Matematik."
--   "Ayşe Yılmaz bu saatte başka bir derste: Pazartesi günü 09:00–09:40 arası 11-A · Fizik."
--
-- İndeksler yerinde kalır (aynı başlangıcın son güvencesi); tetikleyici
-- onlardan önce çalışır ve Türkçe cümleyi o verir.
--
-- Üretimde ölçüldü (2026-10-12): etkin 1 ders satırı, kesişen öğretmen ya da
-- sınıf dersi 0 — kural mevcut veriyi bozmaz.
--
-- Kilit sırası: tetikleyiciler ada göre çalışır — derslik
-- (`…_room_is_free`), sonra bu (`…_times_do_not_overlap`): sınıf, sonra
-- öğretmen. Her yazma aynı sırayla kilitlediği için iki eşzamanlı yazma
-- birbirini kilitleyemez.

create function public.internal_lesson_overlap_text(
  target_class_id uuid,
  target_membership_id uuid,
  target_day smallint,
  target_starts time,
  target_ends time,
  except_entry_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with cakisan as (
    select
      diger.*,
      case when diger.class_id = target_class_id then 1 else 2 end as tur
    from public.schedule_entries as diger
    where diger.day_of_week = target_day
      and diger.archived_at is null
      and diger.id is distinct from except_entry_id
      and (
        diger.class_id = target_class_id
        or (target_membership_id is not null and diger.membership_id = target_membership_id)
      )
      and public.internal_lesson_minutes(diger.starts_at, diger.ends_at)
          && public.internal_lesson_minutes(target_starts, target_ends)
  )
  select format(
           '%s bu saatte başka bir derste: %s günü %s–%s arası %s.',
           case when cakisan.tur = 1 then sinif.name
                else coalesce(nullif(btrim(profil.display_name), ''), 'Öğretmen') end,
           (array['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'])[cakisan.day_of_week],
           to_char(cakisan.starts_at, 'HH24:MI'),
           coalesce(to_char(cakisan.ends_at, 'HH24:MI'), '?'),
           case when cakisan.tur = 1 then coalesce(ders.name, cakisan.title, 'ders')
                else sinif.name || coalesce(' · ' || coalesce(ders.name, cakisan.title), '') end
         )
  from cakisan
  join public.classes as sinif on sinif.id = cakisan.class_id
  left join public.subjects as ders on ders.id = cakisan.subject_id
  left join public.organization_memberships as uyelik on uyelik.id = cakisan.membership_id
  left join public.profiles as profil on profil.id = uyelik.user_id
  order by cakisan.tur, cakisan.starts_at
  limit 1;
$$;

comment on function public.internal_lesson_overlap_text(uuid, uuid, smallint, time, time, uuid) is
  'Aynı sınıfın ya da aynı öğretmenin saati kesişen etkin dersini Türkçe anlatır; yoksa null. Önce sınıf (v1.5-15, 2026-10-12).';

create function public.enforce_lesson_times_do_not_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cakisma text;
begin
  if new.archived_at is not null then
    return new;
  end if;

  -- Aynı sınıfa / öğretmene aynı anda iki yazma birbirini görmeden geçmesin.
  perform pg_advisory_xact_lock(hashtextextended('orbit-class:' || new.class_id::text, 0));
  if new.membership_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('orbit-teacher:' || new.membership_id::text, 0));
  end if;

  cakisma := public.internal_lesson_overlap_text(
    new.class_id, new.membership_id, new.day_of_week, new.starts_at, new.ends_at, new.id);
  if cakisma is not null then
    raise exception '%', cakisma
      using errcode = 'ORB07',
            hint = 'Dersin saatini ya da gününü değiştirin; öğretmen çakışıyorsa başka bir öğretmen seçin.';
  end if;
  return new;
end;
$$;

create trigger schedule_entries_times_do_not_overlap
  before insert or update of class_id, membership_id, day_of_week, starts_at, ends_at, archived_at
  on public.schedule_entries
  for each row execute function public.enforce_lesson_times_do_not_overlap();

revoke all on function public.internal_lesson_overlap_text(uuid, uuid, smallint, time, time, uuid) from public, anon, authenticated;
revoke all on function public.enforce_lesson_times_do_not_overlap() from public, anon, authenticated;
