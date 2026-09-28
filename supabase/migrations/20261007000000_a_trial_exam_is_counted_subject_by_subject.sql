-- Deneme sınavı ders ders sayılır: doğru, yanlış, net.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Karar (2026-09-28, Arda Bülent): deneme sonuçları **ders ders doğru /
-- yanlış** girilir, net sistem tarafından hesaplanır. Bugüne kadar her
-- öğrencinin sınavda tek bir puanı vardı (`exam_results.score`); TYT/AYT/LGS
-- denemesinde öğretmen neti elle hesaplayıp tek sayı yazıyordu ve "Türkçe'de
-- kaç net" sorusunun cevabı hiçbir yerde yoktu.
--
-- =========================================================================
-- Toplam net, mevcut puan alanına yazılır — tek kaynak
-- =========================================================================
--
-- Sistemin geri kalanı (Genel Bakış'ın "son sınav"ı, raporlar, sınav
-- katılımcı sayısı, öğrenci profili) `exam_results.score` okuyor. Neti ayrı
-- bir yerde tutup her okuyucuyu iki kaynağa bakar hâle getirmek yerine:
--
--   * Ders bölümleri `exam_sections`, öğrenci başına doğru/yanlış
--     `exam_section_results`'ta durur.
--   * Toplam net **veritabanı tarafından** hesaplanıp `exam_results.score`a
--     yazılır (`recompute_exam_net`). Okuyucular değişmez.
--   * Netli bir sınavda `exam_results.score` istemciden YAZILAMAZ: türetilmiş
--     bir değerin iki yazarı olursa biri diğerini sessizce ezer (K-06).
--
-- Net = doğru − yanlış / `net_penalty`. `net_penalty` sınavın kuralıdır:
-- YKS'de 4 (dört yanlış bir doğruyu götürür), LGS'de 3. Boşsa sınav eski
-- düzende tek puanlıdır; mevcut sınavların hiçbiri değişmez.
--
-- Net eksiye düşebilir (yanlış çoksa); `exam_results.score`'un alt sınırı
-- zaten bilinçli olarak yok (`20260904230000`).
--
-- =========================================================================
-- Sınıf ortalaması: öğrenci ve veli görür, tek tek puanlar açılmaz
-- =========================================================================
--
-- Karar: öğrenci ve veli kendi puanının yanında sınıf ortalamasını görür.
-- `exam_results` RLS'i onlara yalnız kendi satırını açar; ortalama bu yüzden
-- `security definer` bir fonksiyondan gelir ve iki koşul taşır:
--
--   1. Çağıran sınavı **görebilmeli**: yönetici, sınıfın öğretmeni, sınıfın
--      öğrencisi ya da velisi; kurum geneli sınavda kurumun üyesi.
--   2. **En az üç sonuç** olmalı. İki kişilik bir sınavda ortalama ile kendi
--      puanını bilen öğrenci diğerinin puanını hesaplar. Eşik altında ortalama
--      NULL döner (gösterilmez), sıfır değil.

-- ---------------------------------------------------------------------------
-- Sınavın net kuralı
-- ---------------------------------------------------------------------------

alter table public.exams
  add column net_penalty smallint,
  add constraint exams_net_penalty_check
    check (net_penalty is null or net_penalty between 2 and 10);

comment on column public.exams.net_penalty is
  'Kaç yanlış bir doğruyu götürür (YKS 4, LGS 3). Boşsa sınav tek puanlıdır ve ders bölümü taşımaz; doluysa exam_results.score toplam nettir ve veritabanı hesaplar.';

grant insert (net_penalty) on public.exams to authenticated;
grant update (net_penalty) on public.exams to authenticated;

drop trigger exams_audit_insert on public.exams;
drop trigger exams_audit_update on public.exams;

create trigger exams_audit_insert
  after insert on public.exams
  for each row execute function public.audit_row_change(
    'exam', 'name', 'exam_date', 'max_score', 'class_id', 'subject_id', 'net_penalty'
  );

create trigger exams_audit_update
  after update on public.exams
  for each row execute function public.audit_row_change(
    'exam', 'name', 'exam_date', 'max_score', 'class_id', 'subject_id', 'net_penalty'
  );

-- Sonuç girildikten sonra sınavın puanlama türü değiştirilemez: tek puanlı
-- sonuçlar net sayılmaya başlar ya da netler elle yazılabilir hâle gelirdi.
-- Kural değeri (4 → 3) değişebilir; toplamlar yeniden hesaplanır.
create or replace function public.enforce_exam_scoring_is_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.net_penalty is null) = (new.net_penalty is null) then
    return new;
  end if;
  if exists (select 1 from public.exam_results where exam_id = new.id)
     or exists (select 1 from public.exam_section_results where exam_id = new.id) then
    raise exception 'Sonuç girilmiş sınavın puanlama türü değiştirilemez.'
      using errcode = 'ORB06',
            hint = 'Tek puan ile ders ders net arasında geçiş yalnız sonuç girilmeden önce yapılabilir.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_exam_scoring_is_settled()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ders bölümleri
-- ---------------------------------------------------------------------------

create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  exam_id uuid not null,
  -- Kurumun dersi. Opsiyonel: "Sosyal Bilimler" gibi birden çok dersi
  -- toplayan bölüm katalogda olmayabilir; ad o zaman `name`'den gelir.
  subject_id uuid,
  name text not null,
  question_count smallint not null,
  position smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_sections_id_exam_key unique (id, exam_id),
  constraint exam_sections_exam_organization_fkey
    foreign key (exam_id, organization_id)
    references public.exams (id, organization_id) on delete restrict,
  constraint exam_sections_subject_organization_fkey
    foreign key (subject_id, organization_id)
    references public.subjects (id, organization_id) on delete restrict,
  constraint exam_sections_name_check
    check (char_length(btrim(name)) between 1 and 80),
  constraint exam_sections_question_count_check
    check (question_count between 1 and 200)
);

comment on table public.exam_sections is
  'Netli bir sınavın ders bölümü (ör. Türkçe 40 soru). Silinmez, arşivlenir; arşivli bölüm nete girmez.';

create unique index exam_sections_exam_name_idx
  on public.exam_sections (exam_id, lower(btrim(name)))
  where archived_at is null;
create index exam_sections_organization_idx
  on public.exam_sections (organization_id);
create index exam_sections_subject_idx
  on public.exam_sections (subject_id);

create trigger exam_sections_set_updated_at
before update on public.exam_sections
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Öğrencinin bölüm sonucu
-- ---------------------------------------------------------------------------

create table public.exam_section_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  exam_id uuid not null,
  section_id uuid not null,
  student_id uuid not null,
  correct smallint not null,
  wrong smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_section_results_section_exam_fkey
    foreign key (section_id, exam_id)
    references public.exam_sections (id, exam_id) on delete restrict,
  constraint exam_section_results_exam_organization_fkey
    foreign key (exam_id, organization_id)
    references public.exams (id, organization_id) on delete restrict,
  constraint exam_section_results_student_organization_fkey
    foreign key (student_id, organization_id)
    references public.students (id, organization_id) on delete restrict,
  constraint exam_section_results_section_student_key unique (section_id, student_id),
  constraint exam_section_results_counts_check check (correct >= 0 and wrong >= 0)
);

comment on table public.exam_section_results is
  'Öğrencinin bir ders bölümündeki doğru ve yanlış sayısı. Boş = soru sayısı − doğru − yanlış. Net ve toplam net veritabanında hesaplanır (exam_results.score).';

create index exam_section_results_exam_student_idx
  on public.exam_section_results (exam_id, student_id);
create index exam_section_results_student_idx
  on public.exam_section_results (student_id);
create index exam_section_results_organization_idx
  on public.exam_section_results (organization_id);

create trigger exam_section_results_set_updated_at
before update on public.exam_section_results
for each row execute function public.set_updated_at();

-- Sınıf bağlı sınavın sonucu yalnız o sınıfın öğrencisine yazılır (K-17).
-- Kural `exam_results`'takiyle aynı fonksiyon: ikisi de exam_id ve
-- student_id taşıyor, iki kopya yazılmaz (K-06).
create trigger exam_section_results_belong_to_exam
before insert on public.exam_section_results
for each row execute function public.enforce_exam_result_belongs_to_exam();

create trigger exams_scoring_is_settled
before update of net_penalty on public.exams
for each row execute function public.enforce_exam_scoring_is_settled();

-- ---------------------------------------------------------------------------
-- Doğru + yanlış soru sayısını aşamaz; bölüm netli sınavdadır
-- ---------------------------------------------------------------------------

create or replace function public.enforce_section_result_fits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  soru smallint;
  arsiv timestamptz;
  ceza smallint;
begin
  select bolum.question_count, bolum.archived_at, sinav.net_penalty
  into soru, arsiv, ceza
  from public.exam_sections as bolum
  join public.exams as sinav on sinav.id = bolum.exam_id
  where bolum.id = new.section_id;

  if ceza is null then
    raise exception 'Bu sınav ders ders net almıyor.'
      using errcode = 'ORB06',
            hint = 'Sınavın net kuralı (net_penalty) boşsa sonuç tek puan olarak girilir.';
  end if;
  if arsiv is not null then
    raise exception 'Bu ders bölümü kaldırılmış.'
      using errcode = 'ORB06';
  end if;
  if new.correct + new.wrong > soru then
    raise exception 'Doğru ve yanlış toplamı soru sayısını aşıyor.'
      using errcode = 'ORB06',
            detail = format('doğru=%s yanlış=%s soru=%s', new.correct, new.wrong, soru);
  end if;
  return new;
end;
$$;

comment on function public.enforce_section_result_fits() is
  'Bölüm sonucu: sınav netli olmalı, bölüm arşivli olmamalı, doğru + yanlış soru sayısını aşmamalı. ORB06.';

revoke all on function public.enforce_section_result_fits()
  from public, anon, authenticated;

create trigger exam_section_results_fit_section
before insert or update on public.exam_section_results
for each row execute function public.enforce_section_result_fits();

-- Soru sayısı, girilmiş bir sonucun altına indirilemez.
create or replace function public.enforce_section_keeps_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  asan integer;
begin
  if new.question_count >= old.question_count then
    return new;
  end if;
  select count(*) into asan
  from public.exam_section_results as sonuc
  where sonuc.section_id = new.id
    and sonuc.correct + sonuc.wrong > new.question_count;
  if asan > 0 then
    raise exception 'Soru sayısı girilmiş sonuçların altına indirilemez.'
      using errcode = 'ORB06',
            detail = format('%s öğrencinin doğru + yanlışı yeni soru sayısını aşıyor', asan);
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_section_keeps_results()
  from public, anon, authenticated;

create trigger exam_sections_keep_results
before update on public.exam_sections
for each row execute function public.enforce_section_keeps_results();

-- Bir bölüm, sonucu olan bir öğrencinin son etkin bölümüyse arşivlenemez:
-- aksi hâlde öğrencinin toplamı dayanaksız kalır, onu kaldırmak da bir
-- silme olurdu (karar 2026-09-28: silme yerine engelle).
create or replace function public.enforce_section_archive_keeps_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kalan integer;
begin
  if not (old.archived_at is null and new.archived_at is not null) then
    return new;
  end if;
  select count(distinct sonuc.student_id) into kalan
  from public.exam_section_results as sonuc
  where sonuc.section_id = new.id
    and not exists (
      select 1
      from public.exam_section_results as diger
      join public.exam_sections as bolum on bolum.id = diger.section_id
      where diger.exam_id = sonuc.exam_id
        and diger.student_id = sonuc.student_id
        and diger.section_id <> new.id
        and bolum.archived_at is null
    );
  if kalan > 0 then
    raise exception 'Bu ders kaldırılamaz: bazı öğrencilerin başka ders sonucu yok.'
      using errcode = 'ORB06',
            detail = format('%s öğrencinin tek sonucu bu derste', kalan),
            hint = 'Önce bu öğrencilerin sonuçlarını başka bir derse girin.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_section_archive_keeps_totals()
  from public, anon, authenticated;

create trigger exam_sections_archive_keeps_totals
before update of archived_at on public.exam_sections
for each row execute function public.enforce_section_archive_keeps_totals();

-- ---------------------------------------------------------------------------
-- Toplam net: tek yazar
-- ---------------------------------------------------------------------------

create or replace function public.recompute_exam_net(
  target_exam_id uuid,
  target_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ceza smallint;
  kurum uuid;
  toplam numeric;
  kayit_var boolean;
begin
  select sinav.net_penalty, sinav.organization_id
  into ceza, kurum
  from public.exams as sinav
  where sinav.id = target_exam_id;

  if ceza is null then
    return;
  end if;

  select
    round(sum(sonuc.correct - sonuc.wrong::numeric / ceza), 2),
    count(*) > 0
  into toplam, kayit_var
  from public.exam_section_results as sonuc
  join public.exam_sections as bolum on bolum.id = sonuc.section_id
  where sonuc.exam_id = target_exam_id
    and sonuc.student_id = target_student_id
    and bolum.archived_at is null;

  -- Bu işlem içinde exam_results'a yazan tek yol budur; koruma tetikleyicisi
  -- bu işareti görünce yazıya izin verir.
  perform set_config('orbit.writing_exam_net', 'on', true);

  -- Öğrencinin hiç etkin bölüm sonucu yoksa yazılacak toplam da yoktur.
  -- Bu durum oluşamaz: sonucu olan bir öğrencinin son etkin bölümü
  -- arşivlenemez (`enforce_section_archive_keeps_totals`). Toplam satırı
  -- hiçbir koşulda silinmez.
  if kayit_var then
    insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (kurum, target_exam_id, target_student_id, toplam)
    on conflict (exam_id, student_id) do update set score = excluded.score
    where public.exam_results.score is distinct from excluded.score;
  end if;

  perform set_config('orbit.writing_exam_net', 'off', true);
end;
$$;

comment on function public.recompute_exam_net(uuid, uuid) is
  'Netli sınavda öğrencinin toplam netini bölüm sonuçlarından hesaplayıp exam_results.score''a yazar. Netli sınavda exam_results''a yazan tek yol. Çağıranın yetkisi, onu tetikleyen bölüm sonucu yazısında RLS ile sınanmıştır.';

revoke all on function public.recompute_exam_net(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.recompute_exam_net_for_section_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_exam_net(new.exam_id, new.student_id);
  return null;
end;
$$;

revoke all on function public.recompute_exam_net_for_section_result()
  from public, anon, authenticated;

create trigger exam_section_results_recompute_net
after insert or update on public.exam_section_results
for each row execute function public.recompute_exam_net_for_section_result();

-- Bölüm arşivlenir/geri alınır ya da sınavın net kuralı değişirse sınavın
-- bütün öğrencilerinin toplamı yeniden hesaplanır.
create or replace function public.recompute_exam_net_for_exam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ogrenci uuid;
  sinav uuid := new.exam_id;
begin
  for ogrenci in
    select distinct sonuc.student_id
    from public.exam_section_results as sonuc
    where sonuc.exam_id = sinav
  loop
    perform public.recompute_exam_net(sinav, ogrenci);
  end loop;
  return null;
end;
$$;

revoke all on function public.recompute_exam_net_for_exam()
  from public, anon, authenticated;

create trigger exam_sections_recompute_net
after update of archived_at on public.exam_sections
for each row
when (old.archived_at is distinct from new.archived_at)
execute function public.recompute_exam_net_for_exam();

create or replace function public.recompute_exam_net_for_penalty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ogrenci uuid;
begin
  for ogrenci in
    select distinct sonuc.student_id
    from public.exam_section_results as sonuc
    where sonuc.exam_id = new.id
  loop
    perform public.recompute_exam_net(new.id, ogrenci);
  end loop;
  return null;
end;
$$;

revoke all on function public.recompute_exam_net_for_penalty()
  from public, anon, authenticated;

create trigger exams_recompute_net
after update of net_penalty on public.exams
for each row
when (old.net_penalty is distinct from new.net_penalty and new.net_penalty is not null)
execute function public.recompute_exam_net_for_penalty();

-- Netli sınavda toplam puan istemciden yazılamaz.
create or replace function public.enforce_exam_net_has_one_writer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.exams as sinav
    where sinav.id = new.exam_id and sinav.net_penalty is not null
  ) and coalesce(current_setting('orbit.writing_exam_net', true), 'off') <> 'on' then
    raise exception 'Bu sınavın toplam neti ders sonuçlarından hesaplanır; elle yazılamaz.'
      using errcode = 'ORB06',
            hint = 'Ders ders doğru ve yanlış girin (exam_section_results).';
  end if;
  return new;
end;
$$;

comment on function public.enforce_exam_net_has_one_writer() is
  'Netli sınavda exam_results.score yalnız recompute_exam_net tarafından yazılır (K-06). ORB06.';

revoke all on function public.enforce_exam_net_has_one_writer()
  from public, anon, authenticated;

create trigger exam_results_net_has_one_writer
before insert or update on public.exam_results
for each row execute function public.enforce_exam_net_has_one_writer();

-- ---------------------------------------------------------------------------
-- RLS — exam_sections: sınav gibi okunur, sınavı yöneten yazar
-- ---------------------------------------------------------------------------

alter table public.exam_sections enable row level security;

revoke all on public.exam_sections from anon, authenticated;
grant select on public.exam_sections to authenticated;
grant insert (organization_id, exam_id, subject_id, name, question_count, position)
  on public.exam_sections to authenticated;
grant update (subject_id, name, question_count, position, archived_at)
  on public.exam_sections to authenticated;

create policy exam_sections_select_member on public.exam_sections
for select to authenticated
using (
  public.current_user_has_membership(organization_id)
  and not (select public.current_user_must_change_password())
);

create policy exam_sections_insert_authorized on public.exam_sections
for insert to authenticated
with check (
  exists (
    select 1 from public.exams as sinav
    where sinav.id = exam_sections.exam_id
      and (
        public.current_user_has_membership(sinav.organization_id, null, array['admin']::public.app_role[])
        or (sinav.class_id is not null and public.current_user_teaches_class(sinav.class_id))
      )
  )
  and not (select public.current_user_must_change_password())
);

create policy exam_sections_update_authorized on public.exam_sections
for update to authenticated
using (
  exists (
    select 1 from public.exams as sinav
    where sinav.id = exam_sections.exam_id
      and (
        public.current_user_has_membership(sinav.organization_id, null, array['admin']::public.app_role[])
        or (sinav.class_id is not null and public.current_user_teaches_class(sinav.class_id))
      )
  )
  and not (select public.current_user_must_change_password())
)
with check (
  exists (
    select 1 from public.exams as sinav
    where sinav.id = exam_sections.exam_id
      and (
        public.current_user_has_membership(sinav.organization_id, null, array['admin']::public.app_role[])
        or (sinav.class_id is not null and public.current_user_teaches_class(sinav.class_id))
      )
  )
  and not (select public.current_user_must_change_password())
);

create trigger exam_sections_audit_insert
  after insert on public.exam_sections
  for each row execute function public.audit_row_change(
    'exam_section', 'exam_id', 'name', 'question_count'
  );

create trigger exam_sections_audit_update
  after update on public.exam_sections
  for each row execute function public.audit_row_change(
    'exam_section', 'exam_id', 'name', 'question_count'
  );

-- ---------------------------------------------------------------------------
-- RLS — exam_section_results: exam_results'ın aynısı
-- ---------------------------------------------------------------------------

alter table public.exam_section_results enable row level security;

revoke all on public.exam_section_results from anon, authenticated;
grant select on public.exam_section_results to authenticated;
grant insert (organization_id, exam_id, section_id, student_id, correct, wrong)
  on public.exam_section_results to authenticated;
grant update (correct, wrong) on public.exam_section_results to authenticated;

create policy exam_section_results_select_admin on public.exam_section_results
for select to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

create policy exam_section_results_select_teacher on public.exam_section_results
for select to authenticated
using (
  public.current_user_teaches_student(student_id)
  and not (select public.current_user_must_change_password())
);

create policy exam_section_results_select_student on public.exam_section_results
for select to authenticated
using (
  public.current_user_owns_student_record(student_id)
  and not (select public.current_user_must_change_password())
);

create policy exam_section_results_select_guardian on public.exam_section_results
for select to authenticated
using (
  public.current_user_guards_student(student_id)
  and not (select public.current_user_must_change_password())
);

create policy exam_section_results_insert_authorized on public.exam_section_results
for insert to authenticated
with check (
  (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    or public.current_user_teaches_student(student_id)
  )
  and not (select public.current_user_must_change_password())
);

create policy exam_section_results_update_authorized on public.exam_section_results
for update to authenticated
using (
  (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    or public.current_user_teaches_student(student_id)
  )
  and not (select public.current_user_must_change_password())
)
with check (
  (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    or public.current_user_teaches_student(student_id)
  )
  and not (select public.current_user_must_change_password())
);

create trigger exam_section_results_audit_insert
  after insert on public.exam_section_results
  for each row execute function public.audit_row_change(
    'exam_section_result', 'section_id', 'student_id', 'correct', 'wrong'
  );

create trigger exam_section_results_audit_update
  after update on public.exam_section_results
  for each row execute function public.audit_row_change(
    'exam_section_result', 'section_id', 'student_id', 'correct', 'wrong'
  );

-- ---------------------------------------------------------------------------
-- Sınıf ortalaması (öğrenci ve velinin de gördüğü)
-- ---------------------------------------------------------------------------

-- Çağıran bu sınavı görebilir mi: yönetici, sınıfın öğretmeni, öğrencisi,
-- velisi; kurum geneli sınavda kurumun üyesi.
create or replace function public.current_user_sees_exam(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.exams as sinav
    where sinav.id = target_exam_id
      and sinav.archived_at is null
      and not public.current_user_must_change_password()
      and (
        public.current_user_has_membership(sinav.organization_id, null, array['admin']::public.app_role[])
        or (
          sinav.class_id is null
          and public.current_user_has_membership(sinav.organization_id)
        )
        or (
          sinav.class_id is not null
          and (
            public.current_user_teaches_class(sinav.class_id)
            or public.current_user_attends_class(sinav.class_id)
            or public.current_user_guards_class(sinav.class_id)
          )
        )
      )
  );
$$;

comment on function public.current_user_sees_exam(uuid) is
  'Çağıran sınavı görebilir mi: yönetici, sınıfın öğretmeni/öğrencisi/velisi; kurum geneli sınavda kurum üyesi. Şifre kilidi içeride de uygulanır.';

revoke all on function public.current_user_sees_exam(uuid) from public, anon, authenticated;

create or replace function public.exam_averages(target_exam_ids uuid[])
returns table (
  exam_id uuid,
  section_id uuid,
  result_count bigint,
  average numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select sinav.id, sinav.net_penalty
    from public.exams as sinav
    where sinav.id = any(target_exam_ids)
      and public.current_user_sees_exam(sinav.id)
  ),
  totals as (
    select sonuc.exam_id, null::uuid as section_id,
           count(*) as result_count,
           avg(sonuc.score) as average
    from public.exam_results as sonuc
    join visible on visible.id = sonuc.exam_id
    group by sonuc.exam_id
  ),
  sections as (
    select sonuc.exam_id, sonuc.section_id,
           count(*) as result_count,
           avg(sonuc.correct - sonuc.wrong::numeric / visible.net_penalty) as average
    from public.exam_section_results as sonuc
    join visible on visible.id = sonuc.exam_id
    join public.exam_sections as bolum
      on bolum.id = sonuc.section_id and bolum.archived_at is null
    group by sonuc.exam_id, sonuc.section_id
  )
  select
    satir.exam_id,
    satir.section_id,
    satir.result_count,
    -- Üç sonuçtan azsa ortalama gösterilmez: kendi puanını bilen, diğerini
    -- hesaplayabilirdi.
    case when satir.result_count >= 3 then round(satir.average, 2) end as average
  from (select * from totals union all select * from sections) as satir;
$$;

comment on function public.exam_averages(uuid[]) is
  'Görülebilen sınavların ortalaması: section_id boş satır toplam puan/net, dolu satır ders bölümü neti. Üçten az sonuçta average NULL (tek tek puan açılmaz). `security definer`; kapsam current_user_sees_exam.';

revoke all on function public.exam_averages(uuid[]) from public, anon;
grant execute on function public.exam_averages(uuid[]) to authenticated;
