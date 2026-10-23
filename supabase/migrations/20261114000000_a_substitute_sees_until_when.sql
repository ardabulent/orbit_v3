-- Vekil dersinde vekilliğin bitiş günü (2026-10-23, ana plan 1.6).
--
-- Öğretmenin Genel Bakış ve Yoklama ekranlarında vekil girdiği ders yalnız
-- "Vekil" rozetiyle görünüyordu; vekilliğin ne zamana kadar sürdüğü
-- yazmıyordu (yönetici Ders Programı'nda "bitiş …" görüyor, vekilin kendisi
-- görmüyordu). Çıktıya `substitute_until` eklendi: vekil satırında süren
-- vekilliğin bitiş günü, kendi dersinde NULL. Aynı öğretmene üst üste binen
-- iki vekillik varsa en geç biten alınır. Yetki ve satır seçimi aynı.
--
-- Dönüş tipi değiştiği için kaldırılıp yeniden kuruluyor; yetki ve yorum geri
-- veriliyor. `teacher_overview_counts` bu fonksiyonu çağırmıyor (yalnız aynı
-- adlı bir sütunu var).

drop function public.my_lessons_today(uuid);

CREATE FUNCTION public.my_lessons_today(target_organization_id uuid)
 RETURNS TABLE(entry_id uuid, starts_at time without time zone, ends_at time without time zone, class_id uuid, class_name text, subject_name text, title text, room text, teacher_name text, attendance_taken boolean, is_substitute boolean, substitute_until date)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with me as (
    select membership.id
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ),
  covering as (
    select cover.absent_membership_id as id, max(cover.ends_on) as ends_on
    from public.substitute_assignments as cover
    where cover.organization_id = target_organization_id
      and cover.archived_at is null
      and cover.substitute_membership_id in (select me.id from me)
      and public.orbit_today() between cover.starts_on and cover.ends_on
    group by cover.absent_membership_id
  )
  select
    lesson.entry_id,
    lesson.starts_at,
    lesson.ends_at,
    lesson.class_id,
    lesson.class_name,
    lesson.subject_name,
    lesson.title,
    lesson.room,
    lesson.teacher_name,
    case
      when public.current_user_teaches_class(lesson.class_id)
        then lesson.attendance_taken
    end as attendance_taken,
    entry.membership_id not in (select me.id from me) as is_substitute,
    case
      when entry.membership_id not in (select me.id from me)
        then (select covering.ends_on from covering where covering.id = entry.membership_id)
    end as substitute_until
  from public.today_lessons(target_organization_id) as lesson
  join public.schedule_entries as entry
    on entry.id = lesson.entry_id
  where entry.membership_id in (select me.id from me)
     or entry.membership_id in (select covering.id from covering)
  order by lesson.starts_at, lesson.class_name;
$function$;

revoke all on function public.my_lessons_today(uuid) from public, anon;
grant execute on function public.my_lessons_today(uuid) to authenticated, service_role;

comment on function public.my_lessons_today(uuid) is
  'Çağıranın bugünkü dersleri: programda öğretmen olarak yazılı olduğu satırlar ve bugün vekili olduğu öğretmenin satırları (is_substitute; substitute_until vekilliğin bitiş günü). Satırlar `today_lessons`''tan gelir. `attendance_taken` çağıranın göremediği sınıfta NULL. `security definer` DEĞİLDİR.';
