#!/usr/bin/env bash
#
# v1.2-21 — Auth → Edge Function → SQL zincirinin uçtan uca kanıtı.
#
# **Neden var.** pgTAP SQL yetkisini çok iyi sınıyor: 421 iddia, dört rol, RLS
# politikaları, trigger'lar. Sınamadığı tek şey **zincirin kendisi** — HTTP
# isteğinin JWT doğrulamasından geçip Edge Function'a ulaşması, oradaki TypeScript
# kodunun RPC'yi doğru imzayla çağırması ve SQL'in beklenen satırı yazması.
#
# Bu boşluk soyut değil. v1.2-16 `internal_create_membership`'in imzasını
# **değiştirdi** (yeni parametre), v1.2-17 araya bir kapı **ekledi**. İkisinde de
# Edge Function TypeScript'i buna uyarlandı — ve o uyarlamanın doğruluğunu
# CI'da hiçbir şey kontrol etmiyordu:
#
#   * `tsc --noEmit` istemci `tsconfig`'ini okuyor, `supabase/functions/` onun
#     kapsamında değil.
#   * ESLint yalnızca `client/src` altına bakıyor.
#   * pgTAP RPC'yi doğrudan çağırıyor, Edge Function'ın onu nasıl çağırdığını
#     görmüyor.
#
# Yani yanlış parametre adıyla yapılan bir RPC çağrısı beş komutluk kapıdan da
# CI'dan da geçer, ve ilk kez **production'da bir yönetici üye eklemeye
# çalıştığında** ortaya çıkardı.
#
# **Neden SQL ile yapılamaz.** `synthetic_email.sh` ile aynı gerekçe: GoTrue bir
# HTTP servisidir, `admin.createUser` bir API çağrısıdır ve `auth.users`'a
# doğrudan INSERT yapmak onu atlar. Zinciri sınamak için zinciri koşturmak
# gerekiyor.
#
# **Ne kanıtlıyor.** Tek senaryo, dört sürümün işini birden geçiyor:
#   v1.2-13 → fonksiyon deploy edilebilir ve modülleri çözülüyor
#   v1.2-16 → kilit üyelikle AYNI işlemde yazılıyor (ayrı bir UPDATE yok)
#   v1.2-17 → aynı anahtarla ikinci istek işi tekrar yapmıyor
#   v1.2-01 → üyelik ve profil gerçekten oluşuyor

# ⚠️ **Yerelde çalıştırırken:** bir Edge Function dosyasını değiştirdikten sonra
# yerel edge runtime'ı yeniden başlatmak GEREKİYOR — `policy = "per_worker"`
# olmasına rağmen değişiklik kendiliğinden yüklenmiyor. Ölçüldü: bozuk kodla
# koşulan test yeşil kaldı, çünkü çalışan hâlâ eski koddu. Yanıltıcı bir yeşil,
# kırmızıdan tehlikelidir.
#
#     docker restart supabase_edge_runtime_orbit_v3
#
# CI'da bu sorun yok: yığın her koşumda sıfırdan kuruluyor.

set -uo pipefail

fail() {
  echo "HATA: $*" >&2
  exit 1
}

# CLI'yi bul: CI'da `setup-cli` PATH'e koyuyor, yerelde `npx` üzerinden
# çağrılıyor. İkisinde de çalışması gerekiyor, aksi halde test yalnızca CI'da
# koşabilirdi ve denetleyen teslimden önce kendisi ölçemezdi.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CLI="supabase"
else
  SUPABASE_CLI="npx --yes supabase"
fi

eval "$($SUPABASE_CLI status -o env)" 2>/dev/null || fail "supabase status okunamadi"

: "${API_URL:?API_URL alınamadı}"
: "${ANON_KEY:?ANON_KEY alınamadı}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY alınamadı}"

readonly PASSWORD="Orbit2026Test"
readonly ORG_CODE=9901
readonly ORG_SLUG="orbit-zincir-testi"
readonly ADMIN_LOGIN="99011000"
readonly ADMIN_EMAIL="${ADMIN_LOGIN}@orbit.invalid"

# PostgREST'e `service_role` ile konuşuluyor: RLS'i baypas ediyor ve bu testin
# konusu yetki değil **zincirin çalışması**. Yetki zaten pgTAP'te ölçülüyor.
rest() {
  local yontem="$1" yol="$2" govde="${3:-}"
  if [ -n "$govde" ]; then
    curl -s -X "$yontem" "${API_URL}/rest/v1/${yol}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "$govde"
  else
    curl -s -X "$yontem" "${API_URL}/rest/v1/${yol}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
  fi
}

json() { node -e "
  const veri = JSON.parse(require('fs').readFileSync(0, 'utf8') || 'null');
  const yol = process.argv[1].split('.');
  let g = veri;
  for (const p of yol) { if (g == null) break; g = Array.isArray(g) ? g[Number(p)] ?? g[0]?.[p] : g[p]; }
  process.stdout.write(g == null ? '' : String(g));
" "$1"; }

# --- Temizlik ----------------------------------------------------------------
#
# pgTAP testleri bir işlemde koşup geri alınıyor; bu test GERÇEK satır yazıyor
# ve geri alamıyor. Temizlik hem BAŞTA hem SONDA çalışıyor:
#
#   * Başta — yarıda kalmış bir koşumdan sonra tekrar çalışabilmek için.
#   * Sonda — veritabanını bulduğu gibi bırakmak için. Bu ikincisi ÖLÇÜLEREK
#     eklendi: bırakılan satırlar pgTAP süitini kırdı. CI'da sıra zaten
#     güvenliydi (pgTAP önce koşuyor) ama o sıra GİZLİ bir bağımlılık olurdu ve
#     adımlar yer değiştirdiğinde pgTAP sebebi anlaşılmayan bir hatayla
#     kırılırdı. Ardını toplayan bir test bu bağımlılığı hiç kurmaz.

kullanici_sil() {
  curl -s -o /dev/null -X DELETE "${API_URL}/auth/v1/admin/users/$1" -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
}

temizle() {
  local org_kimlik kullanicilar kid
  org_kimlik=$(rest GET "organizations?code=eq.${ORG_CODE}&select=id" | json "id")
  [ -n "$org_kimlik" ] || return 0

  kullanicilar=$(rest GET "organization_memberships?organization_id=eq.${org_kimlik}&select=user_id" | node -e "
    const s = JSON.parse(require('fs').readFileSync(0,'utf8') || '[]');
    process.stdout.write(s.map(r => r.user_id).join(' '));
  ")

  rest DELETE "audit_events?organization_id=eq.${org_kimlik}" >/dev/null
  rest DELETE "organization_memberships?organization_id=eq.${org_kimlik}" >/dev/null
  rest DELETE "branches?organization_id=eq.${org_kimlik}" >/dev/null
  rest DELETE "organizations?id=eq.${org_kimlik}" >/dev/null

  for kid in $kullanicilar; do
    # Kapı defteri `auth.users`'a yabancı anahtarla bağlı değil; ayrıca silinir.
    rest DELETE "internal_function_calls?caller_user_id=eq.${kid}" >/dev/null
    kullanici_sil "$kid"
  done
}

temizle
echo "0/7 temiz başlangıç"

# --- 1) Kurum, şube ve yönetici hazırlanıyor --------------------------------

org_id=$(rest POST "organizations" \
  "{\"name\":\"Zincir Testi Dershanesi\",\"slug\":\"${ORG_SLUG}\",\"code\":${ORG_CODE}}" | json "id")
[ -n "$org_id" ] || fail "kurum oluşturulamadı"

branch_id=$(rest POST "branches" \
  "{\"organization_id\":\"${org_id}\",\"name\":\"Merkez\",\"is_default\":true}" | json "id")
[ -n "$branch_id" ] || fail "şube oluşturulamadı"

curl -s -o /tmp/zincir_admin -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}" >/dev/null

admin_user_id=$(json "id" < /tmp/zincir_admin)
[ -n "$admin_user_id" ] || { cat /tmp/zincir_admin; fail "yönetici auth kullanıcısı oluşturulamadı"; }

rest POST "organization_memberships" \
  "{\"organization_id\":\"${org_id}\",\"branch_id\":\"${branch_id}\",\"user_id\":\"${admin_user_id}\",\"role\":\"admin\",\"status\":\"active\",\"person_code\":1000}" >/dev/null

echo "1/7 kurum, şube ve yönetici hazır (org ${org_id})"

# --- 2) Yönetici giriş yapıp gerçek bir JWT alıyor --------------------------
#
# `service_role` anahtarıyla çağırmak zinciri sınamazdı: fonksiyon çağıranın
# kimliğini JWT'den çözüyor ve yetki kontrolünü ona göre yapıyor.

signin_kod=$(curl -s -o /tmp/zincir_signin -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${PASSWORD}\"}")

[ "$signin_kod" = "200" ] || { cat /tmp/zincir_signin; fail "yönetici giriş yapamadı (HTTP ${signin_kod})"; }

access_token=$(json "access_token" < /tmp/zincir_signin)
[ -n "$access_token" ] || fail "giriş başarılı ama access_token dönmedi"

echo "2/7 yönetici giriş yaptı ve JWT aldı"

# --- 3) Zincir: HTTP → JWT → Edge Function → RPC → SQL ----------------------

readonly IDEMPOTENCY_KEY="zincir-testi-$(date +%s)"

ilk_kod=$(curl -s -o /tmp/zincir_uye -w '%{http_code}' \
  -X POST "${API_URL}/functions/v1/create-member" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d "{\"fullName\":\"Zincir Ogretmeni\",\"role\":\"teacher\",\"branchId\":\"${branch_id}\"}")

if [ "$ilk_kod" != "201" ]; then
  echo "--- yanıt ---"
  cat /tmp/zincir_uye
  echo
  fail "create-member zinciri kırıldı (HTTP ${ilk_kod}).
Bu testin varlık sebebi tam olarak bu: Edge Function TypeScript'i ile SQL
imzaları arasındaki uyumsuzluk başka hiçbir kontrolde görünmüyor."
fi

login_number=$(json "data.login_number" < /tmp/zincir_uye)
temporary_password=$(json "data.temporary_password" < /tmp/zincir_uye)

[ -n "$login_number" ] || fail "üye oluştu ama giriş numarası dönmedi"
[ -n "$temporary_password" ] || fail "üye oluştu ama geçici şifre dönmedi"

echo "3/7 zincir çalıştı (HTTP 201, giriş no ${login_number})"

# --- 4) Kilit ÜYELİKLE AYNI İŞLEMDE yazıldı mı? -----------------------------
#
# v1.2-16'nın kanıtı. Öncesinde kilit ayrı bir UPDATE ile konuyordu ve o UPDATE
# başarısız olduğunda üye geçici şifresiyle SÜRESİZ kalıyordu. Artık RPC'nin
# işleminin içinde; üyelik varsa kilit de vardır.

yeni_uye_id=$(rest GET "organization_memberships?organization_id=eq.${org_id}&role=eq.teacher&select=user_id" | json "user_id")
[ -n "$yeni_uye_id" ] || fail "üyelik satırı bulunamadı — RPC yazmamış olabilir"

kilit=$(rest GET "profiles?id=eq.${yeni_uye_id}&select=must_change_password" | json "must_change_password")
[ "$kilit" = "true" ] || fail "kilit kurulmamış (must_change_password=${kilit}).
Kâğıda yazılan geçici şifre süresiz ve değiştirilmesi zorunlu olmayan bir
kimlik bilgisine dönüşmüş demektir."

echo "4/7 kilit üyelikle aynı işlemde yazılmış (must_change_password=true)"

# --- 5) Aynı anahtarla ikinci istek işi TEKRAR YAPMIYOR ---------------------
#
# v1.2-17'nin kanıtı. Yanıtı kaybolan bir yönetici düğmeye ikinci kez bastığında
# aynı kişi için ikinci bir hesap açılmamalı.

ikinci_kod=$(curl -s -o /tmp/zincir_tekrar -w '%{http_code}' \
  -X POST "${API_URL}/functions/v1/create-member" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d "{\"fullName\":\"Zincir Ogretmeni\",\"role\":\"teacher\",\"branchId\":\"${branch_id}\"}")

[ "$ikinci_kod" = "200" ] || { cat /tmp/zincir_tekrar; fail "tekrarlanan istek 200 dönmedi (HTTP ${ikinci_kod})"; }

replayed=$(json "data.replayed" < /tmp/zincir_tekrar)
[ "$replayed" = "true" ] || fail "tekrarlanan istek replay olarak işaretlenmedi"

# ⛔ Bu dilimin kırmızı çizgisi: tekrar, şifreyi geri VERMEZ. Saklamak,
# şifrenin hiçbir yere yazılmaması kararını bozmak olurdu.
tekrar_sifre=$(json "data.temporary_password" < /tmp/zincir_tekrar)
[ -z "$tekrar_sifre" ] || fail "tekrarlanan istek geçici şifre döndürdü — şifre bir yerde saklanıyor demektir"

ogretmen_sayisi=$(rest GET "organization_memberships?organization_id=eq.${org_id}&role=eq.teacher&select=user_id" \
  | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0,'utf8')||'[]').length))")

[ "$ogretmen_sayisi" = "1" ] || fail "tekrar sonrası ${ogretmen_sayisi} öğretmen var, 1 olmalıydı"

echo "5/7 tekrarlanan istek işi tekrar yapmadı (replay, şifre dönmedi, tek üye)"

# --- 6) Yeni üye gerçekten giriş yapabiliyor mu? ----------------------------
#
# Zincirin son halkası: üretilen giriş numarası ve geçici şifre çalışıyor mu.
# Bu olmadan "üye oluşturuldu" bir iddia, kanıt değil.

uye_signin=$(curl -s -o /tmp/zincir_uye_giris -w '%{http_code}' \
  -X POST "${API_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${login_number}@orbit.invalid\",\"password\":\"${temporary_password}\"}")

[ "$uye_signin" = "200" ] || { cat /tmp/zincir_uye_giris; fail "yeni üye giriş yapamadı (HTTP ${uye_signin})"; }

echo "6/7 yeni üye giriş numarası ve geçici şifresiyle giriş yaptı"

# --- 7) Kilitli yönetici hiçbir Edge işini yaptıramaz ------------------------
#
# v1.5-20'nin kanıtı (2026-10-03). 2026-09-19'da ölçülmüştü: kilitli yönetici
# jetonuyla `create-member` HTTP 201 döndü. Kilit artık bütün fonksiyonların
# geçtiği istek kapısında; jeton hâlâ geçerliyken bile iş yapılmaz.

rest PATCH "profiles?id=eq.${admin_user_id}" '{"must_change_password":true}' >/dev/null

kilitli_kod=$(curl -s -o /tmp/zincir_kilitli -w '%{http_code}' \
  -X POST "${API_URL}/functions/v1/create-member" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Kilitli Deneme\",\"role\":\"teacher\",\"branchId\":\"${branch_id}\"}")

[ "$kilitli_kod" = "403" ] || { cat /tmp/zincir_kilitli; fail "kilitli yönetici üye açabildi (HTTP ${kilitli_kod})"; }
[ "$(json "error" < /tmp/zincir_kilitli)" = "password_change_required" ] || { cat /tmp/zincir_kilitli; fail "kilitli yönetici yanlış hata aldı"; }

ogretmen_uyelik=$(rest GET "organization_memberships?organization_id=eq.${org_id}&role=eq.teacher&select=id" | json "id")
rol_kod=$(curl -s -o /tmp/zincir_kilitli_rol -w '%{http_code}' \
  -X POST "${API_URL}/functions/v1/change-member-role" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -d "{\"membershipId\":\"${ogretmen_uyelik}\",\"role\":\"parent\"}")

[ "$rol_kod" = "403" ] || { cat /tmp/zincir_kilitli_rol; fail "kilitli yönetici rol değiştirebildi (HTTP ${rol_kod})"; }

ogretmen_sayisi=$(rest GET "organization_memberships?organization_id=eq.${org_id}&role=eq.teacher&select=user_id" \
  | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0,'utf8')||'[]').length))")
[ "$ogretmen_sayisi" = "1" ] || fail "kilitli denemeler sonrası ${ogretmen_sayisi} öğretmen var, 1 olmalıydı"

echo "7/7 kilitli yönetici reddedildi (create-member ve change-member-role 403, hiçbir şey değişmedi)"
echo
echo "Auth → Edge Function → SQL zinciri uçtan uca çalışıyor."


# Veritabanı bulunduğu gibi bırakılıyor — gerekçe yukarıda.
temizle
echo "Test verisi temizlendi."