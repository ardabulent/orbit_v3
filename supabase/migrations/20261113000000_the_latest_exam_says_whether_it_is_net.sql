-- Öğrencinin son sınavı netli mi (2026-10-23, ana plan 1.6, test turu B10).
--
-- Netli denemede toplam net `exam_results.score`'a yazılıyor ve öğrenci
-- listesi onu "17 puan" diye gösteriyordu: liste fonksiyonu sınavın netli
-- olduğunu söylemiyordu. Çıktıya `net_penalty` eklendi (yalnız yeni sütun;
-- yetki ve gövdenin geri kalanı birebir aynı). Dönüş tipi değiştiği için
-- `create or replace` yetmiyor: kaldırılıp yeniden kuruluyor, yetkiler ve
-- yorum geri veriliyor. `student_overview_counts` adla çağırıyor ve yalnız
-- var olan sütunları okuyor; etkilenmez.

drop function public.student_latest_exam_scores(uuid[]);

CREATE FUNCTION public.student_latest_exam_scores(target_student_ids uuid[])
 RETURNS TABLE(student_id uuid, score numeric, exam_id uuid, exam_name text, exam_date date, max_score numeric, net_penalty smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ham as materialized (
    select
      sonuc.student_id,
      sonuc.score,
      sinav.id as exam_id,
      sinav.name as exam_name,
      sinav.exam_date,
      sinav.max_score,
      sinav.net_penalty,
      sinav.organization_id
    from public.exam_results as sonuc
    join public.exams as sinav
      on sinav.id = sonuc.exam_id
     and sinav.organization_id = sonuc.organization_id
    where sonuc.student_id = any(target_student_ids)
      and sinav.archived_at is null
  ),
  cift as materialized (
    select distinct student_id, organization_id from ham
  ),
  gorunur as (
    select cift.student_id
    from cift
    where
      not (select public.current_user_must_change_password())
      and public.current_user_has_membership(cift.organization_id)
      and (
        public.current_user_has_membership(
          cift.organization_id, null, array['admin']::public.app_role[]
        )
        or public.current_user_teaches_student(cift.student_id)
        or public.current_user_owns_student_record(cift.student_id)
        or public.current_user_guards_student(cift.student_id)
      )
  )
  select distinct on (ham.student_id)
    ham.student_id,
    ham.score,
    ham.exam_id,
    ham.exam_name,
    ham.exam_date,
    ham.max_score,
    ham.net_penalty
  from ham
  join gorunur on gorunur.student_id = ham.student_id
  order by ham.student_id, ham.exam_date desc, ham.exam_id desc;
$function$;

revoke all on function public.student_latest_exam_scores(uuid[]) from public, anon;
grant execute on function public.student_latest_exam_scores(uuid[]) to authenticated, service_role;

comment on function public.student_latest_exam_scores(uuid[]) is
  'Öğrenci başına en son sınav sonucu (netli sınavda score toplam nettir; net_penalty doluysa "net" diye gösterilir). Yetki (öğrenci, kurum) ikilisi başına BİR KEZ çözülür ve exam_results ile exams politikalarının KESİŞİMİDİR — kurumda aktif üyeliği olmayan biri, öğrenci kaydı bağlı olsa da sonuç görmez. Sonucu olmayan öğrenci çıktıda hiç yoktur (K-22).';
