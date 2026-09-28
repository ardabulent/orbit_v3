-- Deneme netleri tek işlemde kaydedilir.
--
-- `exam_section_results`'a istemciden `upsert` yazılamıyor: PostgREST
-- çakışmada yükteki BÜTÜN sütunları günceller, `organization_id`,
-- `section_id`, `student_id` sütunlarının güncelleme yetkisi yok (ve olmamalı
-- — bir sonucu başka öğrenciye taşımak notu tahrif etmektir). Tek puanlı
-- sınavda aynı sorun `record_exam_results` ile çözülmüştü (`20260911020000`);
-- bu fonksiyon onun ders ders karşılığı ve aynı yetki kuralını taşır.
--
-- Kurallar tabloda duruyor, burada tekrar yazılmıyor (K-06):
--   * öğrenci sınavın sınıfında (`exam_section_results_belong_to_exam`, ORB02)
--   * sınav netli, bölüm etkin, doğru + yanlış ≤ soru (`…_fit_section`, ORB06)
--   * toplam net yeniden hesaplanır (`…_recompute_net`)
--
-- Boş bırakılan hücre (doğru ve yanlış ikisi de boş) yazılmaz: "girilmedi"
-- ile "0 doğru 0 yanlış" farklı şeyler (K-03). Yazılmış bir sonuç bu
-- fonksiyonla silinmez.

create or replace function public.record_exam_section_results(
  target_exam_id uuid,
  entries jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function public.record_exam_section_results(uuid, jsonb) is
  'Netli bir sınavın ders ders doğru/yanlışlarını tek işlemde yazar. entries: [{"section_id", "student_id", "correct", "wrong"}]. Var olan sonuçta yalnız doğru ve yanlış güncellenir; değişmeyen satıra dokunulmaz. Kurallar tablo tetikleyicilerinde; toplam net otomatik hesaplanır.';

revoke all on function public.record_exam_section_results(uuid, jsonb) from public, anon;
grant execute on function public.record_exam_section_results(uuid, jsonb) to authenticated;
