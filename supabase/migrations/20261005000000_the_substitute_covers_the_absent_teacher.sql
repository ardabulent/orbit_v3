-- Vekil öğretmen: izinli öğretmenin yerine, tarih aralığı boyunca.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- `20261002000000` ölçüp yazdı: programa yazılan ama sınıfa atanmamış bir
-- öğretmen (vekil) program satırını görüyor, **sınıfı görmüyor**
-- (`classes_select_teacher` yalnız `current_user_teaches_class`'a bakıyor).
-- Sınıfı, öğrencileri, yoklamayı göremeyen bir vekil dersi fiilen veremez.
--
-- Karar (2026-09-27 / 2026-09-28, Arda Bülent):
--   * Vekili **yönetici** atar.
--   * Vekil bir **öğretmenin yerine** geçer, tek tek ders saatlerinin değil:
--     "Murat 5–20 Ekim izinli, yerine Ayşe" → o tarihlerde Murat'ın bütün
--     sınıfları Ayşe'ye açılır. Tek günlük vekillik: başlangıç = bitiş.
--   * O süre boyunca vekil **sınıfın öğretmeni gibidir**: sınıfı, geçmiş
--     kayıtlar dahil görür, yoklama alır, not girer.
--   * İzinli öğretmenin yetkisi **değişmez** (izinden dönünce ya da evden not
--     girebilir). Yalnız vekile ek yetki açılır — en dar değişiklik.
--
-- =========================================================================
-- Yetki tek yerden açılıyor
-- =========================================================================
--
-- "Bu kişi bu sınıfa ders veriyor mu" sorusu tek fonksiyonda
-- (`current_user_teaches_class`). Sınıf, öğrenci (`teaches_student`),
-- yoklama (`can_record_attendance`), sınav, ödev, duyuru politikaları ona
-- soruyor. Vekilliği oraya üçüncü bir kaynak olarak eklemek, vekile tam
-- olarak izinli öğretmenin sınıflarını açar — ne fazla, ne eksik — ve süre
-- bitince **kimse bir şey kapatmadan** kapanır.
--
-- "İzinli öğretmenin sınıfı" = onun ders ataması (`class_teachers`) veya
-- rehberliği olan sınıf; yani `current_user_teaches_class`'ın ilk iki
-- kaynağının aynısı. **Zincirlenmez:** vekilin vekili, ilk vekillik
-- üzerinden yetki kazanmaz (üçüncü kaynak kendini çağırmaz).
--
-- "Bugün" kurum saatiyle (`orbit_today()`); `current_date` KULLANILMAZ.
--
-- Program satırına (`schedule_entries.membership_id`) yazılmak hâlâ yetki
-- VERMEZ (`20260905060000` — "bir referans uygunluk vermez"). Yetki yalnız
-- yöneticinin açtığı, tarihli ve denetim defterine yazılan bu satırdan gelir.

create table public.substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  -- İzinli (yerine geçilen) öğretmen.
  absent_membership_id uuid not null,
  -- Vekil.
  substitute_membership_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint substitute_assignments_absent_organization_fkey
    foreign key (absent_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint substitute_assignments_substitute_organization_fkey
    foreign key (substitute_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint substitute_assignments_dates_check check (ends_on >= starts_on),
  constraint substitute_assignments_distinct_people_check
    check (absent_membership_id <> substitute_membership_id),
  constraint substitute_assignments_note_check
    check (note is null or char_length(btrim(note)) between 1 and 500)
);

comment on table public.substitute_assignments is
  'Vekil ataması: izinli öğretmenin sınıfları, starts_on–ends_on (kurum saati, iki uç dahil) boyunca vekile açılır. Yetkiyi current_user_teaches_class okur. Silinmez, arşivlenir.';

-- Sıcak yol: `current_user_teaches_class` vekil satırını vekilin üyeliğiyle
-- arar. Arşivlenmiş satır yetki taşımadığı için dizine girmez.
create index substitute_assignments_substitute_idx
  on public.substitute_assignments (substitute_membership_id, starts_on, ends_on)
  where archived_at is null;
create index substitute_assignments_absent_idx
  on public.substitute_assignments (absent_membership_id)
  where archived_at is null;
create index substitute_assignments_organization_idx
  on public.substitute_assignments (organization_id, starts_on);

create trigger substitute_assignments_set_updated_at
before update on public.substitute_assignments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Uygunluk: iki taraf da ders verebilen biri (K-18)
-- ---------------------------------------------------------------------------
--
-- Vekil öğrenci ya da veli olamaz; izinli taraf da öyle — öğrencinin "yerine
-- geçmek" anlamsız ve öğrencinin hiçbir sınıfı `teaches_class` kaynağı
-- olmadığı için sessizce boş bir vekillik doğardı.

create or replace function public.enforce_substitute_is_eligible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.membership_may_teach(new.substitute_membership_id)
     or not public.membership_may_teach(new.absent_membership_id) then
    raise exception 'Vekil ataması yalnız öğretmenler arasında yapılabilir.'
      using errcode = 'ORB03',
            detail = format(
              'absent=%s, substitute=%s',
              new.absent_membership_id, new.substitute_membership_id
            ),
            hint = 'İki üyeliğin de rolü admin veya teacher olmalı.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_substitute_is_eligible() is
  'substitute_assignments iki tarafı da admin veya teacher rolündeki bir üyeliği göstermeli (K-18).';

revoke all on function public.enforce_substitute_is_eligible()
  from public, anon, authenticated;

create trigger substitute_assignments_members_are_eligible
before insert or update on public.substitute_assignments
for each row execute function public.enforce_substitute_is_eligible();

-- ---------------------------------------------------------------------------
-- Rol, ayakta duran bir vekilliğin altından çekilemez
-- ---------------------------------------------------------------------------
--
-- `20260905060000` §4'ün aynısı: vekil atandıktan sonra rolü `parent`'a
-- çevrilirse vekillik satırı yetki taşımaya devam ederdi. Ölçüt yine
-- `current_user_teaches_class`'ın okuduğu satırlar: arşivlenmemiş ve bitişi
-- bugün veya sonra (bitmiş vekillik canlı yetki değildir, engellemez).

create or replace function public.enforce_role_change_keeps_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ders_atamasi integer;
  rehberlik integer;
  program_satiri integer;
  vekillik integer;
begin
  if new.role is not distinct from old.role
     or new.role in ('admin', 'teacher') then
    return new;
  end if;

  select count(*) into ders_atamasi
  from public.class_teachers as atama
  where atama.membership_id = new.id
    and atama.archived_at is null;

  select count(*) into rehberlik
  from public.classes as sinif
  where sinif.mentor_membership_id = new.id
    and sinif.archived_at is null;

  select count(*) into program_satiri
  from public.schedule_entries as satir
  where satir.membership_id = new.id
    and satir.archived_at is null;

  select count(*) into vekillik
  from public.substitute_assignments as vekil
  where vekil.substitute_membership_id = new.id
    and vekil.archived_at is null
    and vekil.ends_on >= public.orbit_today();

  if ders_atamasi + rehberlik + program_satiri + vekillik > 0 then
    raise exception 'Bu üyeliğin rolü değiştirilemez: ayakta duran ders ataması var.'
      using errcode = 'ORB03',
            detail = format(
              'ders ataması=%s, rehberlik=%s, program satırı=%s, vekillik=%s',
              ders_atamasi, rehberlik, program_satiri, vekillik
            ),
            hint = 'Önce ilgili atamaları arşivleyin, sonra rolü değiştirin.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_role_change_keeps_assignments() is
  'Ayakta duran bir ders ataması veya süren/gelecek vekillik varken üyeliğin rolü student/parent yapılamaz (K-18). Arşivlenmiş atamalar ve bitmiş vekillikler engellemez: ölçüt current_user_teaches_class ile birebir aynı satırlara bakar.';

-- ---------------------------------------------------------------------------
-- Yetki: üçüncü kaynak
-- ---------------------------------------------------------------------------

create or replace function public.current_user_teaches_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_teachers as assignment
    join public.organization_memberships as membership
      on membership.id = assignment.membership_id
    where assignment.class_id = target_class_id
      and assignment.archived_at is null
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  or exists (
    select 1
    from public.classes as class_row
    join public.organization_memberships as membership
      on membership.id = class_row.mentor_membership_id
    where class_row.id = target_class_id
      and class_row.archived_at is null
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  -- Vekillik: bugün süren bir vekilliğim var ve yerine geçtiğim öğretmen bu
  -- sınıfa ders veriyor ya da rehberi. İzinli öğretmenin üyelik durumu
  -- sorulmaz — izinli olması askıya alınmış olmasını gerektirmez, alınmışsa
  -- da sınıf vekilsiz kalmamalı.
  or exists (
    select 1
    from public.substitute_assignments as cover
    join public.organization_memberships as membership
      on membership.id = cover.substitute_membership_id
    where cover.archived_at is null
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (select public.orbit_today()) between cover.starts_on and cover.ends_on
      and (
        exists (
          select 1
          from public.class_teachers as absent_assignment
          where absent_assignment.class_id = target_class_id
            and absent_assignment.membership_id = cover.absent_membership_id
            and absent_assignment.archived_at is null
        )
        or exists (
          select 1
          from public.classes as absent_class
          where absent_class.id = target_class_id
            and absent_class.archived_at is null
            and absent_class.mentor_membership_id = cover.absent_membership_id
        )
      )
  );
$$;

comment on function public.current_user_teaches_class(uuid) is
  'Çağıran bu sınıfa ders veriyor, rehberi, ya da bugün bu sınıfın öğretmeninin vekili mi (substitute_assignments, kurum saatiyle). Yalnızca çağıranın kendi kapsamını döndürür.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.substitute_assignments enable row level security;

-- Varsayılan ayrıcalıklar anon'a da açıyor; diğer tablolarla aynı kalıp:
-- hepsini kapat, gerekeni sütun sütun aç. Kişiler ve kurum sonradan
-- değiştirilemez — başka biri vekil olacaksa iptal edilip yenisi açılır,
-- denetim defteri de böylece "kim kimin yerine" sorusunu tek satırda cevaplar.
revoke all on public.substitute_assignments from anon, authenticated;
grant select on public.substitute_assignments to authenticated;
grant insert (
  organization_id, absent_membership_id, substitute_membership_id,
  starts_on, ends_on, note
) on public.substitute_assignments to authenticated;
grant update (starts_on, ends_on, note, archived_at)
  on public.substitute_assignments to authenticated;

create policy substitute_assignments_select_admin on public.substitute_assignments
for select to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

-- Vekil kendi vekilliğini, izinli öğretmen kendi yerine kimin baktığını
-- görür. Başka öğretmenlerin izin kayıtları görünmez.
create policy substitute_assignments_select_self on public.substitute_assignments
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships as membership
    where membership.id in (
        substitute_assignments.substitute_membership_id,
        substitute_assignments.absent_membership_id
      )
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  and not (select public.current_user_must_change_password())
);

create policy substitute_assignments_insert_admin on public.substitute_assignments
for insert to authenticated
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

create policy substitute_assignments_update_admin on public.substitute_assignments
for update to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
)
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

-- Silme yok: vekillik iptal edilir (arşiv). Kimin ne zaman erişim kazandığı
-- denetim defterinin ilk sorusu (`20260913020000`).

create trigger substitute_assignments_audit_insert
  after insert on public.substitute_assignments
  for each row execute function public.audit_row_change(
    'substitute_assignment', 'absent_membership_id', 'substitute_membership_id',
    'starts_on', 'ends_on'
  );

create trigger substitute_assignments_audit_update
  after update on public.substitute_assignments
  for each row execute function public.audit_row_change(
    'substitute_assignment', 'absent_membership_id', 'substitute_membership_id',
    'starts_on', 'ends_on'
  );

-- ---------------------------------------------------------------------------
-- Vekilin günü: izinli öğretmenin bugünkü dersleri vekilin dersidir
-- ---------------------------------------------------------------------------
--
-- `20261002000000`'daki "benim dersim" = programda benim yazılı olduğum
-- satır. Vekillik süresince izinli öğretmenin satırları da benimdir; satırda
-- öğretmen adı değişmez (program haftalıktır, izin tarihli), `is_substitute`
-- ekranın "Murat Kaya yerine" yazmasını sağlar.
--
-- Dönüş tipi değiştiği için fonksiyon düşürülüp yeniden kuruluyor.

drop function public.my_lessons_today(uuid);

create function public.my_lessons_today(target_organization_id uuid)
returns table (
  entry_id uuid,
  starts_at time,
  ends_at time,
  class_id uuid,
  class_name text,
  subject_name text,
  title text,
  room text,
  teacher_name text,
  attendance_taken boolean,
  is_substitute boolean
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select membership.id
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ),
  covering as (
    select cover.absent_membership_id as id
    from public.substitute_assignments as cover
    where cover.organization_id = target_organization_id
      and cover.archived_at is null
      and cover.substitute_membership_id in (select me.id from me)
      and public.orbit_today() between cover.starts_on and cover.ends_on
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
    entry.membership_id not in (select me.id from me) as is_substitute
  from public.today_lessons(target_organization_id) as lesson
  join public.schedule_entries as entry
    on entry.id = lesson.entry_id
  where entry.membership_id in (select me.id from me)
     or entry.membership_id in (select covering.id from covering)
  order by lesson.starts_at, lesson.class_name;
$$;

comment on function public.my_lessons_today(uuid) is
  'Çağıranın bugünkü dersleri: programda öğretmen olarak yazılı olduğu satırlar ve bugün vekili olduğu öğretmenin satırları (is_substitute). Satırlar `today_lessons`''tan gelir. `attendance_taken` çağıranın göremediği sınıfta NULL. `security definer` DEĞİLDİR.';

revoke all on function public.my_lessons_today(uuid) from public, anon;
grant execute on function public.my_lessons_today(uuid) to authenticated;

-- Sayılar aynı tanımı kullanır: vekil olduğum dersler "bugünkü derslerim"e
-- girer; sınıfları artık `current_user_teaches_class` ile benim sınıflarım
-- olduğundan yoklama eksiği de sayılır.
create or replace function public.teacher_overview_counts(target_organization_id uuid)
returns table (
  my_classes bigint,
  my_students bigint,
  my_lessons_today bigint,
  classes_missing_attendance_today bigint,
  homework_awaiting_marking bigint
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select membership.id
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ),
  covering as (
    select cover.absent_membership_id as id
    from public.substitute_assignments as cover
    where cover.organization_id = target_organization_id
      and cover.archived_at is null
      and cover.substitute_membership_id in (select me.id from me)
      and public.orbit_today() between cover.starts_on and cover.ends_on
  ),
  my_classes as (
    select klass.id
    from public.classes as klass
    where klass.organization_id = target_organization_id
      and klass.archived_at is null
      and public.current_user_teaches_class(klass.id)
  ),
  my_entries_today as (
    select entry.class_id
    from public.schedule_entries as entry
    join public.classes as klass
      on klass.id = entry.class_id
    where entry.organization_id = target_organization_id
      and entry.archived_at is null
      and klass.archived_at is null
      and (
        entry.membership_id in (select me.id from me)
        or entry.membership_id in (select covering.id from covering)
      )
      and entry.day_of_week = extract(isodow from public.orbit_today())::smallint
  )
  select
    (select count(*) from my_classes) as my_classes,
    (
      select count(distinct enrollment.student_id)
      from public.class_enrollments as enrollment
      join public.students as student
        on student.id = enrollment.student_id
      where enrollment.organization_id = target_organization_id
        and enrollment.archived_at is null
        and student.archived_at is null
        and enrollment.class_id in (select my_classes.id from my_classes)
    ) as my_students,
    (select count(*) from my_entries_today) as my_lessons_today,
    (
      select count(distinct entry.class_id)
      from my_entries_today as entry
      -- Göremediğim sınıfın yoklaması sayılmaz (programa yazılı ama atamasız).
      where entry.class_id in (select my_classes.id from my_classes)
        and not exists (
          select 1
          from public.attendance_sessions as session
          where session.organization_id = target_organization_id
            and session.class_id = entry.class_id
            and session.session_date = public.orbit_today()
            and session.archived_at is null
        )
    ) as classes_missing_attendance_today,
    (
      select count(*)
      from public.homework_assignments as homework
      join public.classes as klass
        on klass.id = homework.class_id
      where homework.organization_id = target_organization_id
        and homework.archived_at is null
        and klass.archived_at is null
        and homework.assigned_by_membership_id in (select me.id from me)
        and homework.due_date < public.orbit_today()
        and homework.submissions_recorded_at is null
    ) as homework_awaiting_marking
  where exists (
    select 1
    from public.organizations as organization
    where organization.id = target_organization_id
  );
$$;

comment on function public.teacher_overview_counts(uuid) is
  'Öğretmen Genel Bakış sayıları: sınıflarım (vekillik dahil), öğrencilerim, bugünkü derslerim (programda benim yazılı olduğum ve bugün vekili olduğum öğretmenin satırları), bugün dersim olup yoklaması alınmamış sınıf (yalnız görebildiğim sınıflar), teslim tarihi geçmiş ve işaretlemesi bitirilmemiş ödevim. Kurum görünmüyorsa HİÇ SATIR dönmez. `security definer` DEĞİLDİR.';
