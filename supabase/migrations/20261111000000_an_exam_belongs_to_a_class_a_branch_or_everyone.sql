-- Sınavın kapsamı: sınıf, şube ya da kurum geneli (2026-10-23, ana plan 1.5).
--
-- Test turu B8: veritabanı kurum geneli sınavı (class_id boş) zaten
-- destekliyordu — sonuç yazma tetikleyicisi "kurumun her öğrencisi uygundur"
-- diyor — ama ekran sınıfı zorunlu tutuyor, sonuç ekranı öğrenciyi yalnız
-- sınıf kaydından topluyordu (`class_id=eq.null` → 400). Kurum sahibinin
-- kararı (2026-10-23): kurum geneli deneme ekrana açılır; şube geneli de.
--
--   class_id dolu                → sınıf sınavı (değişmedi)
--   class_id boş, branch_id dolu → şube geneli: o şubenin öğrencileri
--   ikisi de boş                 → kurum geneli: kurumun bütün öğrencileri
--
-- Yetki değişmedi: öğretmen yalnız okuttuğu sınıfa sınav açar; sınıfsız sınavı
-- yalnız yönetici açar (exams_insert_authorized zaten `class_id is not null`
-- şartıyla öğretmene izin veriyor).
--
-- Sınav kapsamı değişirken mevcut sonuçlar dışarıda kalamaz; önceki kural
-- yalnız tek puanlı sonuçlara (`exam_results`) bakıyordu, netli sonuçlar
-- (`exam_section_results`) da artık sayılıyor.

alter table public.exams
  add column branch_id uuid;

alter table public.exams
  add constraint exams_branch_organization_fkey
  foreign key (branch_id, organization_id)
  references public.branches (id, organization_id)
  on delete restrict;

alter table public.exams
  add constraint exams_one_scope_check
  check (branch_id is null or class_id is null);

comment on column public.exams.branch_id is
  'Şube geneli sınav: class_id boşken o şubenin öğrencileri girer. İkisi de boşsa kurum geneli. 2026-10-23.';

create index exams_branch_id_idx on public.exams (branch_id) where branch_id is not null;

create or replace function public.enforce_exam_result_belongs_to_exam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sinavin_sinifi uuid;
  sinavin_subesi uuid;
  sinav_var boolean;
begin
  select sinav.class_id, sinav.branch_id, true
  into sinavin_sinifi, sinavin_subesi, sinav_var
  from public.exams as sinav
  where sinav.id = new.exam_id;

  -- Sınav yoksa yabancı anahtara bırak.
  if sinav_var is null then
    return new;
  end if;

  if sinavin_sinifi is not null then
    if not exists (
      select 1
      from public.class_enrollments as kayit
      where kayit.student_id = new.student_id
        and kayit.class_id = sinavin_sinifi
    ) then
      raise exception 'Öğrenci bu sınavın sınıfına kayıtlı değil.'
        using errcode = 'ORB02',
              detail = format(
                'student_id=%s sınavın class_id=%s', new.student_id, sinavin_sinifi
              ),
              hint = 'Sınav kurum ya da şube geneliyse class_id boş bırakılmalıdır.';
    end if;
  elsif sinavin_subesi is not null then
    if not exists (
      select 1
      from public.students as ogrenci
      where ogrenci.id = new.student_id
        and ogrenci.branch_id = sinavin_subesi
    ) then
      raise exception 'Öğrenci bu sınavın şubesinde değil.'
        using errcode = 'ORB02',
              detail = format(
                'student_id=%s sınavın branch_id=%s', new.student_id, sinavin_subesi
              ),
              hint = 'Sınav kurum geneliyse branch_id de boş bırakılmalıdır.';
    end if;
  end if;
  -- İkisi de boş: kurum geneli; kurumun her öğrencisi uygundur (kurum eşleşmesi
  -- yabancı anahtar ve RLS'te).

  return new;
end;
$$;

create or replace function public.enforce_exam_class_change_keeps_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  disarida_kalan integer;
begin
  -- Kapsam değişmediyse ya da kurum geneline genişlediyse kontrol gerekmez.
  if new.class_id is not distinct from old.class_id
     and new.branch_id is not distinct from old.branch_id then
    return new;
  end if;
  if new.class_id is null and new.branch_id is null then
    return new;
  end if;

  select count(*)
  into disarida_kalan
  from (
    select sonuc.student_id from public.exam_results as sonuc where sonuc.exam_id = new.id
    union
    select bolum.student_id from public.exam_section_results as bolum where bolum.exam_id = new.id
  ) as sonuclar
  where case
    when new.class_id is not null then not exists (
      select 1
      from public.class_enrollments as kayit
      where kayit.student_id = sonuclar.student_id
        and kayit.class_id = new.class_id
    )
    else not exists (
      select 1
      from public.students as ogrenci
      where ogrenci.id = sonuclar.student_id
        and ogrenci.branch_id = new.branch_id
    )
  end;

  if disarida_kalan > 0 then
    raise exception 'Sınavın kapsamı daraltılamaz: mevcut sonuçların bir kısmı yeni kapsamın dışında kalıyor.'
      using errcode = 'ORB02',
            detail = format('%s öğrencinin sonucu yeni kapsama ait değil', disarida_kalan),
            hint = 'Önce ilgili sonuçları kaldırın veya sınavı kurum geneli bırakın.';
  end if;

  return new;
end;
$$;

-- `exams` üzerinde yazma yetkisi sütun sütun verilmiş (yeni sütun kendiliğinden
-- yazılamaz). Şubeyi yalnız yönetici seçebilir; o sınırı RLS çiziyor.
grant insert (branch_id), update (branch_id) on public.exams to authenticated;
