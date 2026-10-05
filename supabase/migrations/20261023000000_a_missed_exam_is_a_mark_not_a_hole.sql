-- ALLOW-DESTRUCTIVE: mark_exam_absent öğrencinin O SINAVDAKİ sonuç satırlarını (exam_results, exam_section_results) "delete from" ile ana tablodan çıkarır; satırların tam kopyası aynı işlemde exam_absences.saved_result'a yazılır ve restore_exam_result onları aynen geri yazar. Veri kaybolmaz, denetim izi kalır (kullanıcı kararı 2026-10-05).
-- "Sınava girmedi" (2026-10-05).
--
-- Kullanıcı kararları: kaldırılan sonucun yerine "Girmedi" işareti kalır,
-- ortalama ve sıralamaya katılmaz, veli ve öğrenci görür; yönetici ve sınıfın
-- öğretmeni işaretler; sebep isteğe bağlı; geri alınabilir; yalnız sınav.
--
-- Tasarım — okuyucular değişmez: sonuçları okuyan 17 fonksiyon (ortalama,
-- sıralama, raporlar, öğrenci ekranı…) var. Her birine "girmediyi atla"
-- eklemek yerine, işaretlenince öğrencinin satırları ana tablodan çıkar ve
-- TAM KOPYASI `exam_absences.saved_result`'a yazılır:
--   * puanlı sınav  → {"score": 72.5}
--   * netli sınav   → {"sections": [{"section_id", "correct", "wrong"}, …]}
-- Okuyucular onu kendiliğinden saymaz. Geri alınca kopya aynen yazılır;
-- netli sınavda net, mevcut tetikleyiciyle yeniden hesaplanır.
--
-- KVKK: sebep ("raporlu") sağlık bilgisi olabilir; denetim kaydına değeri
-- değil yalnız değiştiği yazılır (`~reason`, #425'teki maske).

create table public.exam_absences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  exam_id uuid not null,
  student_id uuid not null,
  reason text check (reason is null or char_length(reason) between 1 and 200),
  saved_result jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (exam_id, organization_id)
    references public.exams (id, organization_id) on delete restrict,
  foreign key (student_id, organization_id)
    references public.students (id, organization_id) on delete restrict
);

create unique index exam_absences_active_idx
  on public.exam_absences (exam_id, student_id) where archived_at is null;
create index exam_absences_student_idx
  on public.exam_absences (student_id) where archived_at is null;

create trigger exam_absences_set_updated_at
  before update on public.exam_absences
  for each row execute function public.set_updated_at();

alter table public.exam_absences enable row level security;

-- Yazma yalnız aşağıdaki iki fonksiyondan; doğrudan yazma yetkisi yok.
revoke all on public.exam_absences from anon, authenticated;
grant select on public.exam_absences to authenticated;

-- Okuma: sonucu kim görebiliyorsa "girmedi"yi de o görür (exam_results ile aynı).
create policy exam_absences_select_admin on public.exam_absences
for select to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);
create policy exam_absences_select_teacher on public.exam_absences
for select to authenticated
using (
  public.current_user_teaches_student(student_id)
  and not (select public.current_user_must_change_password())
);
create policy exam_absences_select_student on public.exam_absences
for select to authenticated
using (
  public.current_user_owns_student_record(student_id)
  and not (select public.current_user_must_change_password())
);
create policy exam_absences_select_guardian on public.exam_absences
for select to authenticated
using (
  public.current_user_guards_student(student_id)
  and not (select public.current_user_must_change_password())
);
create policy exam_absences_tenant_prefilter on public.exam_absences
as restrictive for select to authenticated
using (
  organization_id = any ((select public.current_user_scope_org_ids())::uuid[])
  and not (select public.current_user_must_change_password())
);

create trigger exam_absences_audit_insert
  after insert on public.exam_absences
  for each row execute function public.audit_row_change(
    'exam_absence', 'exam_id', 'student_id', '~reason');
create trigger exam_absences_audit_update
  after update on public.exam_absences
  for each row execute function public.audit_row_change(
    'exam_absence', 'exam_id', 'student_id', '~reason');

-- ---------------------------------------------------------------------------
-- Ortak yetki: sonucu girebilen işaretleyebilir.
-- ---------------------------------------------------------------------------
create function public.internal_exam_for_result_writer(p_exam_id uuid)
returns public.exams
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sinav public.exams;
begin
  select * into sinav
  from public.exams as exam_row
  where exam_row.id = p_exam_id and exam_row.archived_at is null;

  if not found then
    raise exception 'Sınav bulunamadı.' using errcode = '23503';
  end if;

  if not (
       public.current_user_has_membership(
         sinav.organization_id, null, array['admin']::public.app_role[])
       or (sinav.class_id is not null
           and public.current_user_teaches_class(sinav.class_id))
     )
     or public.current_user_must_change_password() then
    raise exception 'Bu sınavın sonuçlarını değiştirme yetkiniz yok.'
      using errcode = '42501';
  end if;

  return sinav;
end;
$$;

revoke all on function public.internal_exam_for_result_writer(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Sınava girmedi" olarak işaretle
-- ---------------------------------------------------------------------------
create function public.mark_exam_absent(
  p_exam_id uuid,
  p_student_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sinav public.exams;
  kopya jsonb;
  sebep text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  sinav := public.internal_exam_for_result_writer(p_exam_id);

  if not exists (
    select 1 from public.students as ogr
    where ogr.id = p_student_id
      and ogr.organization_id = sinav.organization_id
  ) then
    raise exception 'Öğrenci bulunamadı.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.exam_absences as yok
    where yok.exam_id = p_exam_id and yok.student_id = p_student_id
      and yok.archived_at is null
  ) then
    raise exception 'Öğrenci bu sınav için zaten "girmedi" olarak işaretli.'
      using errcode = '22023';
  end if;

  if sinav.net_penalty is not null then
    select jsonb_build_object('sections', coalesce(jsonb_agg(jsonb_build_object(
             'section_id', sonuc.section_id,
             'correct', sonuc.correct,
             'wrong', sonuc.wrong) order by sonuc.section_id), '[]'::jsonb))
      into kopya
      from public.exam_section_results as sonuc
     where sonuc.exam_id = p_exam_id and sonuc.student_id = p_student_id;
  else
    select coalesce(
             (select jsonb_build_object('score', sonuc.score)
                from public.exam_results as sonuc
               where sonuc.exam_id = p_exam_id and sonuc.student_id = p_student_id),
             '{}'::jsonb)
      into kopya;
  end if;

  insert into public.exam_absences
    (organization_id, exam_id, student_id, reason, saved_result)
  values
    (sinav.organization_id, p_exam_id, p_student_id, sebep, kopya);

  -- Kopya yazıldı; sonuç satırları ana tablodan çıkar (okuyucular saymaz).
  delete from public.exam_section_results
   where exam_id = p_exam_id and student_id = p_student_id;
  delete from public.exam_results
   where exam_id = p_exam_id and student_id = p_student_id;
end;
$$;

comment on function public.mark_exam_absent(uuid, uuid, text) is
  'Öğrenciyi sınava girmedi olarak işaretler: sonucunun tam kopyası exam_absences.saved_result''a yazılır, satırlar ana tablodan çıkar (ortalama/sıralama saymaz). Yönetici ya da sınıfın öğretmeni. 2026-10-05.';

-- ---------------------------------------------------------------------------
-- Geri al: kopya aynen geri yazılır
-- ---------------------------------------------------------------------------
create function public.restore_exam_result(p_exam_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sinav public.exams;
  yok public.exam_absences;
begin
  sinav := public.internal_exam_for_result_writer(p_exam_id);

  select * into yok
  from public.exam_absences as kayit
  where kayit.exam_id = p_exam_id and kayit.student_id = p_student_id
    and kayit.archived_at is null;

  if not found then
    raise exception 'Bu öğrenci için geri alınacak bir "girmedi" işareti yok.'
      using errcode = 'P0002';
  end if;

  update public.exam_absences set archived_at = now() where id = yok.id;

  if sinav.net_penalty is not null then
    -- Yalnız hâlâ etkin derslerin sonuçları; net tetikleyiciyle yeniden
    -- hesaplanır. Arşivlenmiş dersin sonucu zaten nete katılmazdı.
    insert into public.exam_section_results
      (organization_id, exam_id, section_id, student_id, correct, wrong)
    select sinav.organization_id, p_exam_id, (bolum ->> 'section_id')::uuid,
           p_student_id, (bolum ->> 'correct')::smallint, (bolum ->> 'wrong')::smallint
      from jsonb_array_elements(coalesce(yok.saved_result -> 'sections', '[]'::jsonb)) as bolum
      join public.exam_sections as aktif
        on aktif.id = (bolum ->> 'section_id')::uuid and aktif.archived_at is null;
  elsif yok.saved_result ? 'score' then
    insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (sinav.organization_id, p_exam_id, p_student_id,
            (yok.saved_result ->> 'score')::numeric);
  end if;
end;
$$;

comment on function public.restore_exam_result(uuid, uuid) is
  '"Sınava girmedi" işaretini geri alır ve arşivlenen sonucu aynen geri yazar (netli sınavda net yeniden hesaplanır). 2026-10-05.';

revoke all on function public.mark_exam_absent(uuid, uuid, text) from public, anon;
revoke all on function public.restore_exam_result(uuid, uuid) from public, anon;
grant execute on function public.mark_exam_absent(uuid, uuid, text) to authenticated;
grant execute on function public.restore_exam_result(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sonuç yazan iki fonksiyon "girmedi" öğrenciye yazmaz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_exam_results(target_exam_id uuid, entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sinav public.exams;
  yetkili boolean;
  yazilan integer;
begin
  select * into sinav
  from public.exams as exam_row
  where exam_row.id = target_exam_id
    and exam_row.archived_at is null;

  if not found then
    raise exception 'Sınav bulunamadı.' using errcode = '23503';
  end if;

  yetkili := public.current_user_has_membership(
               sinav.organization_id, null, array['admin']::public.app_role[]
             )
             or (sinav.class_id is not null
                 and public.current_user_teaches_class(sinav.class_id));

  if not yetkili or public.current_user_must_change_password() then
    raise exception 'Bu sınavın sonuçlarını girme yetkiniz yok.'
      using errcode = '42501',
            hint = 'Sonuçları kurum yöneticisi veya sınavın sınıfını okutan öğretmen girebilir.';
  end if;

  if jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'Sonuç listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  -- "Sınava girmedi" işaretli öğrenciye sonuç yazılmaz (2026-10-05): önce
  -- işaret geri alınır. Aksi halde arşivdeki kopya ile yeni sonuç çatışırdı.
  if exists (
    select 1
    from jsonb_array_elements(entries) as girdi
    join public.exam_absences as yok
      on yok.exam_id = target_exam_id
     and yok.student_id = (girdi ->> 'student_id')::uuid
     and yok.archived_at is null
  ) then
    raise exception 'Sınava girmedi olarak işaretli öğrenciye sonuç yazılamaz; önce işareti geri alın.'
      using errcode = '22023';
  end if;

  with girdiler as (
    select
      (girdi ->> 'student_id')::uuid as student_id,
      (girdi ->> 'score')::numeric as score
    from jsonb_array_elements(entries) as girdi
  ),
  yazim as (
    insert into public.exam_results (organization_id, exam_id, student_id, score)
    select sinav.organization_id, target_exam_id, girdiler.student_id, girdiler.score
    from girdiler
    -- Yalnız `score`. Diğer sütunları SET etmek hem yetki hatası verirdi
    -- (ölçüldü) hem de yanlış olurdu: bir sonucu başka bir öğrenciye taşımak
    -- notu tahrif etmektir.
    on conflict (exam_id, student_id) do update
      set score = excluded.score
    returning 1
  )
  select count(*) into yazilan from yazim;

  return yazilan;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_exam_section_results(target_exam_id uuid, entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sinav public.exams;
  yetkili boolean;
  yazilan integer;
begin
  select * into sinav
  from public.exams as exam_row
  where exam_row.id = target_exam_id
    and exam_row.archived_at is null;

  if not found then
    raise exception 'Sınav bulunamadı.' using errcode = '23503';
  end if;

  yetkili := public.current_user_has_membership(
               sinav.organization_id, null, array['admin']::public.app_role[]
             )
             or (sinav.class_id is not null
                 and public.current_user_teaches_class(sinav.class_id));

  if not yetkili or public.current_user_must_change_password() then
    raise exception 'Bu sınavın sonuçlarını girme yetkiniz yok.'
      using errcode = '42501',
            hint = 'Sonuçları kurum yöneticisi veya sınavın sınıfını okutan öğretmen girebilir.';
  end if;

  if jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'Sonuç listesi bir dizi olmalı.' using errcode = '22023';
  end if;

  -- "Sınava girmedi" işaretli öğrenciye sonuç yazılmaz (2026-10-05): önce
  -- işaret geri alınır. Aksi halde arşivdeki kopya ile yeni sonuç çatışırdı.
  if exists (
    select 1
    from jsonb_array_elements(entries) as girdi
    join public.exam_absences as yok
      on yok.exam_id = target_exam_id
     and yok.student_id = (girdi ->> 'student_id')::uuid
     and yok.archived_at is null
  ) then
    raise exception 'Sınava girmedi olarak işaretli öğrenciye sonuç yazılamaz; önce işareti geri alın.'
      using errcode = '22023';
  end if;

  with girdiler as (
    select
      (girdi ->> 'section_id')::uuid as section_id,
      (girdi ->> 'student_id')::uuid as student_id,
      (girdi ->> 'correct')::smallint as correct,
      (girdi ->> 'wrong')::smallint as wrong
    from jsonb_array_elements(entries) as girdi
  ),
  yazim as (
    insert into public.exam_section_results
      (organization_id, exam_id, section_id, student_id, correct, wrong)
    select sinav.organization_id, target_exam_id, girdiler.section_id,
           girdiler.student_id, girdiler.correct, girdiler.wrong
    from girdiler
    -- Bölüm bu sınavın mı: değilse yabancı anahtar (section_id, exam_id)
    -- reddeder. Yalnız doğru ve yanlış güncellenir.
    on conflict (section_id, student_id) do update
      set correct = excluded.correct,
          wrong = excluded.wrong
    where public.exam_section_results.correct is distinct from excluded.correct
       or public.exam_section_results.wrong is distinct from excluded.wrong
    returning 1
  )
  select count(*) into yazilan from yazim;

  return yazilan;
end;
$function$;
