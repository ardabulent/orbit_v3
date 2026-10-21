#!/usr/bin/env node
// Yerel geliştirme tohumu: boş yerel veritabanına örnek bir kurum kurar.
//
// Neden SQL dosyası (supabase/seed.sql) değil: hesaplar GoTrue'nun API'siyle
// açılmak zorunda (`auth.users`'a doğrudan INSERT GoTrue doğrulamasını atlar,
// bkz. supabase/tests/auth/synthetic_email.sh) ve seed.sql CI'daki pgTAP
// koşusuna da girerdi. Bu betik veriyi arayüzün yazdığı yoldan yazar —
// Edge Function, RPC, RLS — yani örnek veri kuralların kendisinden geçer.
//
// Yalnız yerel adreste çalışır; canlı veya uzak bir adres verilirse durur.
//
// Kullanım (depo kökünden, `supabase start` ayaktayken):
//   pnpm yerel:tohum
// Anahtarlar `supabase status -o env` çıktısından okunur. CLI farklı bir
// yoldaysa SUPABASE_CLI ile verilir; ya da API_URL, ANON_KEY ve
// SERVICE_ROLE_KEY doğrudan ortamdan geçilir.
//
// Bütün örnek hesapların şifresi aynıdır (ORBIT_YEREL_SIFRE, yoksa README'deki
// varsayılan). Şifreler ekrana yazılmaz; giriş numaraları yazılır.

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const VARSAYILAN_SIFRE = "Yerel-Orbit-2026";
const SIFRE = process.env.ORBIT_YEREL_SIFRE || VARSAYILAN_SIFRE;
const OPERATOR_EPOSTA = "operator@orbit.test";
const KURUM_KISA_AD = "ornek-dershane";
const ORIGIN = "http://127.0.0.1:5173";

function anahtarlariOku() {
  const ortam = {
    API_URL: process.env.API_URL,
    ANON_KEY: process.env.ANON_KEY,
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
  };
  if (ortam.API_URL && ortam.ANON_KEY && ortam.SERVICE_ROLE_KEY) return ortam;

  const cli = process.env.SUPABASE_CLI || "npx --yes supabase";
  let cikti;
  try {
    cikti = execSync(`${cli} status -o env`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    console.error(
      "[tohum] `supabase status` çalışmadı. Yerel yığın ayakta mı (`supabase start`)? CLI başka bir yoldaysa SUPABASE_CLI ile verin."
    );
    console.error(String(error.stderr || error.message).slice(0, 400));
    process.exit(1);
  }
  const degerler = Object.fromEntries(
    cikti
      .split(/\r?\n/)
      .map(satir => satir.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map(eslesme => [eslesme[1], eslesme[2]])
  );
  return {
    API_URL: degerler.API_URL,
    // Yeni CLI sürümleri anahtarları PUBLISHABLE_KEY / SECRET_KEY adıyla da verir.
    ANON_KEY: degerler.ANON_KEY || degerler.PUBLISHABLE_KEY,
    SERVICE_ROLE_KEY: degerler.SERVICE_ROLE_KEY || degerler.SECRET_KEY,
  };
}

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = anahtarlariOku();
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("[tohum] API adresi veya anahtarlar okunamadı.");
  process.exit(1);
}
const host = new URL(API_URL).hostname;
if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
  // Bu betik bilinen bir şifreyle hesap açar; yerel dışında koşması bir arka
  // kapı açmak demektir.
  console.error(
    `[tohum] ${API_URL} yerel bir adres değil. Tohum yalnız yerel veritabanına yazılır.`
  );
  process.exit(1);
}

// --- HTTP yardımcıları -----------------------------------------------------

class TohumHatasi extends Error {}

async function cagir(adim, url, secenekler) {
  const yanit = await fetch(url, secenekler);
  const metin = await yanit.text();
  let govde;
  try {
    govde = metin ? JSON.parse(metin) : null;
  } catch {
    govde = metin;
  }
  if (!yanit.ok) {
    throw new TohumHatasi(
      `${adim}: HTTP ${yanit.status} ${JSON.stringify(govde).slice(0, 300)}`
    );
  }
  return govde;
}

const json = (yetki, anahtar = ANON_KEY) => ({
  apikey: anahtar,
  Authorization: `Bearer ${yetki}`,
  "Content-Type": "application/json",
});

const tablo = (adim, jeton, yontem, yol, govde) =>
  cagir(adim, `${API_URL}/rest/v1/${yol}`, {
    method: yontem,
    headers: { ...json(jeton), Prefer: "return=representation" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });

const rpc = (adim, jeton, fonksiyon, argumanlar = {}) =>
  cagir(adim, `${API_URL}/rest/v1/rpc/${fonksiyon}`, {
    method: "POST",
    headers: json(jeton),
    body: JSON.stringify(argumanlar),
  });

const edge = async (adim, jeton, fonksiyon, govde) =>
  (
    await cagir(adim, `${API_URL}/functions/v1/${fonksiyon}`, {
      method: "POST",
      headers: {
        ...json(jeton),
        Origin: ORIGIN,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(govde),
    })
  )?.data ?? {};

async function girisYap(adim, eposta, sifre) {
  const oturum = await cagir(
    adim,
    `${API_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: eposta, password: sifre }),
    }
  );
  return oturum.access_token;
}

// Geçici şifreyle girip ortak yerel şifreye geçer; kilit tetikleyiciyle kalkar.
async function ilkGiris(ad, girisNumarasi, geciciSifre) {
  const eposta = `${girisNumarasi}@orbit.invalid`;
  const jeton = await girisYap(`${ad} ilk giriş`, eposta, geciciSifre);
  await cagir(`${ad} şifre değişimi`, `${API_URL}/auth/v1/user`, {
    method: "PUT",
    headers: json(jeton),
    body: JSON.stringify({ password: SIFRE }),
  });
  await rpc(`${ad} şifre denetim kaydı`, jeton, "log_own_password_change");
  return girisYap(`${ad} yeni şifreyle giriş`, eposta, SIFRE);
}

// --- Tarih yardımcıları (Türkiye saati) ------------------------------------

const bugun = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const gun = fark =>
  new Date(Date.parse(bugun) + fark * 864e5).toISOString().slice(0, 10);
const haftaninGunu = ((new Date(bugun).getUTCDay() + 6) % 7) + 1;

// --- Tohum ----------------------------------------------------------------

async function operatoruHazirla() {
  const servis = json(SERVICE_ROLE_KEY, SERVICE_ROLE_KEY);
  const mevcut = await cagir(
    "operatör arama",
    `${API_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: servis }
  );
  let kullanici = mevcut.users?.find(u => u.email === OPERATOR_EPOSTA);
  if (!kullanici) {
    kullanici = await cagir(
      "operatör hesabı",
      `${API_URL}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: servis,
        body: JSON.stringify({
          email: OPERATOR_EPOSTA,
          password: SIFRE,
          email_confirm: true,
          user_metadata: { full_name: "Yerel Operatör" },
        }),
      }
    );
  }
  await cagir(
    "operatör kaydı",
    `${API_URL}/rest/v1/platform_operators?on_conflict=user_id`,
    {
      method: "POST",
      headers: { ...servis, Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        user_id: kullanici.id,
        note: "Yerel geliştirme tohumu",
      }),
    }
  );
  return girisYap("operatör girişi", OPERATOR_EPOSTA, SIFRE);
}

async function kurumVarMi() {
  const kurumlar = await cagir(
    "kurum arama",
    `${API_URL}/rest/v1/organizations?slug=eq.${KURUM_KISA_AD}&select=id`,
    { headers: json(SERVICE_ROLE_KEY, SERVICE_ROLE_KEY) }
  );
  return kurumlar.length > 0;
}

async function tohumla() {
  if (await kurumVarMi()) {
    console.log(
      `[tohum] "${KURUM_KISA_AD}" zaten var; hiçbir şey yazılmadı. Sıfırdan kurmak için: supabase db reset && pnpm yerel:tohum`
    );
    return;
  }

  const hesaplar = [["Platform operatörü", OPERATOR_EPOSTA]];
  const OP = await operatoruHazirla();

  // Kurum: operatör açar, yönetici ilk girişte şifresini değiştirir.
  const kurulum = await edge("kurum kurulumu", OP, "bootstrap-organization", {
    organizationName: "Örnek Dershane",
    organizationSlug: KURUM_KISA_AD,
    branchName: "Merkez",
    adminFullName: "Selin Aydın",
  });
  const org = kurulum.organization_id;
  const yoneticiNo = kurulum.login_number ?? kurulum.admin_login_number;
  const ADM = await ilkGiris(
    "Yönetici",
    yoneticiNo,
    kurulum.temporary_password
  );
  hesaplar.push(["Yönetici — Selin Aydın", yoneticiNo]);

  const [merkez] = await tablo(
    "şube listesi",
    ADM,
    "GET",
    `branches?organization_id=eq.${org}&select=id`
  );
  const [kadikoy] = await tablo("ikinci şube", ADM, "POST", "branches", {
    organization_id: org,
    name: "Kadıköy",
  });

  const dersler = await tablo(
    "dersler",
    ADM,
    "POST",
    "subjects",
    ["Matematik", "Fizik", "Türkçe", "Kimya"].map(name => ({
      organization_id: org,
      name,
    }))
  );
  const [mat, fiz, tur, kim] = dersler.map(d => d.id);
  const [derslik1] = await tablo(
    "derslikler",
    ADM,
    "POST",
    "rooms",
    ["Derslik 1", "Derslik 2"].map(name => ({ organization_id: org, name }))
  );

  // Üyeler: yönetici açar, her biri ilk girişte şifresini değiştirir.
  const uye = async (ad, rol, etiket, subeId = null) => {
    const sonuc = await edge(`üye: ${ad}`, ADM, "create-member", {
      fullName: ad,
      role: rol,
      branchId: subeId,
    });
    const jeton = await ilkGiris(
      ad,
      sonuc.login_number,
      sonuc.temporary_password
    );
    hesaplar.push([`${etiket} — ${ad}`, sonuc.login_number]);
    return { uyelik: sonuc.membership_id, jeton };
  };
  const murat = await uye("Murat Şahin", "teacher", "Öğretmen (Matematik)");
  const elif = await uye(
    "Elif Demir",
    "teacher",
    "Öğretmen (Fizik, Kadıköy)",
    kadikoy.id
  );
  const ogrenciHesap = await uye("Deniz Kaya", "student", "Öğrenci");
  const veliHesap = await uye("Hülya Kaya", "parent", "Veli (Deniz ve Ece)");

  const [sinifA, sinifB] = await tablo("sınıflar", ADM, "POST", "classes", [
    {
      organization_id: org,
      name: "12-A Sayısal",
      branch_id: merkez.id,
      capacity: 20,
    },
    {
      organization_id: org,
      name: "11-B Eşit Ağırlık",
      branch_id: kadikoy.id,
      capacity: 20,
    },
  ]);

  // Öğrenciler ve veliler içe aktarmayla girer (Excel ekranının kullandığı RPC).
  const satir = (ad, no, sinif, veli, telefon) => ({
    full_name: ad,
    student_number: no,
    class_name: sinif,
    guardian_name: veli,
    guardian_phone: telefon,
  });
  const ogrenciler = [
    satir("Deniz Kaya", "1001", "12-A Sayısal", "Hülya Kaya", "05000000001"),
    satir("Ece Kaya", "1002", "12-A Sayısal", "Hülya Kaya", "05000000001"),
    satir("Mert Yıldız", "1003", "12-A Sayısal", "Ahmet Yıldız", "05000000002"),
    satir(
      "Zeynep Arslan",
      "1004",
      "12-A Sayısal",
      "Ayşe Arslan",
      "05000000003"
    ),
    satir("Emre Koç", "1005", "12-A Sayısal", "Fatma Koç", "05000000004"),
    satir(
      "Elif Çelik",
      "1006",
      "11-B Eşit Ağırlık",
      "Ali Çelik",
      "05000000005"
    ),
    satir(
      "Burak Aksoy",
      "1007",
      "11-B Eşit Ağırlık",
      "Sevgi Aksoy",
      "05000000006"
    ),
    satir(
      "Selin Polat",
      "1008",
      "11-B Eşit Ağırlık",
      "Kemal Polat",
      "05000000007"
    ),
  ];
  await rpc("öğrenci içe aktarma", ADM, "import_students", {
    p_organization_id: org,
    p_rows: ogrenciler,
    p_dry_run: false,
  });
  const ogrList = await tablo(
    "öğrenci listesi",
    ADM,
    "GET",
    `students?organization_id=eq.${org}&select=id,student_number`
  );
  const ogr = Object.fromEntries(ogrList.map(o => [o.student_number, o.id]));
  const [hulya] = await tablo(
    "veli arama",
    ADM,
    "GET",
    `guardians?organization_id=eq.${org}&full_name=eq.${encodeURIComponent("Hülya Kaya")}&select=id`
  );

  await rpc("öğrenci hesabı eşleme", ADM, "link_student_account", {
    target_student_id: ogr["1001"],
    target_membership_id: ogrenciHesap.uyelik,
  });
  await rpc("veli hesabı eşleme", ADM, "link_guardian_account", {
    target_guardian_id: hulya.id,
    target_membership_id: veliHesap.uyelik,
  });

  await tablo("sınıf öğretmenleri", ADM, "POST", "class_teachers", [
    {
      organization_id: org,
      class_id: sinifA.id,
      membership_id: murat.uyelik,
      subject_id: mat,
    },
    {
      organization_id: org,
      class_id: sinifB.id,
      membership_id: elif.uyelik,
      subject_id: fiz,
    },
  ]);
  await tablo("rehber öğretmen", ADM, "PATCH", `classes?id=eq.${sinifA.id}`, {
    mentor_membership_id: murat.uyelik,
  });

  // Ders programı: bugün bir ders + haftalık şablon.
  await tablo("bugünkü ders", ADM, "POST", "schedule_entries", {
    organization_id: org,
    class_id: sinifA.id,
    subject_id: mat,
    membership_id: murat.uyelik,
    day_of_week: haftaninGunu,
    starts_at: "09:00",
    ends_at: "09:40",
    room_id: derslik1.id,
  });
  const sablon = await rpc("program şablonu", ADM, "save_schedule_template", {
    p_organization_id: org,
    p_template_id: null,
    p_name: "Hafta içi sabah",
    p_slots: [
      { day_of_week: 1, starts_at: "10:00", ends_at: "10:40", subject_id: mat },
      { day_of_week: 2, starts_at: "10:00", ends_at: "10:40", subject_id: fiz },
      { day_of_week: 3, starts_at: "10:00", ends_at: "10:40", subject_id: tur },
      { day_of_week: 4, starts_at: "10:00", ends_at: "10:40", subject_id: kim },
    ],
  });
  await rpc("şablonu uygulama", ADM, "apply_schedule_template", {
    p_template_id: typeof sablon === "string" ? sablon : sablon?.id,
    p_class_ids: [sinifA.id, sinifB.id],
    p_mode: "fill",
    p_dry_run: false,
  });

  // Yoklama, ödev, sınav: öğretmen kendi sınıfına yazar.
  const T = murat.jeton;
  const [yoklama] = await tablo(
    "yoklama oturumu",
    T,
    "POST",
    "attendance_sessions",
    {
      organization_id: org,
      class_id: sinifA.id,
      subject_id: mat,
      session_date: bugun,
      starts_at: "09:00",
    }
  );
  await rpc("yoklama", T, "record_attendance", {
    target_session_id: yoklama.id,
    entries: [
      { student_id: ogr["1001"], status: "present" },
      { student_id: ogr["1002"], status: "present" },
      { student_id: ogr["1003"], status: "late" },
      { student_id: ogr["1004"], status: "absent" },
      { student_id: ogr["1005"], status: "present" },
    ],
  });

  await tablo("ödev", T, "POST", "homework_assignments", {
    organization_id: org,
    class_id: sinifA.id,
    subject_id: mat,
    title: "Türev alıştırmaları",
    description: "Kitap sayfa 40-45",
    due_date: gun(3),
  });

  const [yazili] = await tablo("yazılı sınav", T, "POST", "exams", {
    organization_id: org,
    class_id: sinifA.id,
    subject_id: mat,
    name: "Matematik 1. Yazılı",
    exam_date: gun(-2),
    max_score: 100,
  });
  await rpc("yazılı notları", T, "record_exam_results", {
    target_exam_id: yazili.id,
    entries: [
      { student_id: ogr["1001"], score: 85 },
      { student_id: ogr["1002"], score: 72 },
      { student_id: ogr["1003"], score: 64 },
      { student_id: ogr["1004"], score: 91 },
      { student_id: ogr["1005"], score: 58 },
    ],
  });

  // Deneme (net): yönetici açar, bölüm bölüm doğru/yanlış girilir.
  const [deneme] = await tablo("deneme sınavı", ADM, "POST", "exams", {
    organization_id: org,
    class_id: sinifA.id,
    name: "TYT Deneme 1",
    exam_date: gun(-7),
    net_penalty: 4,
  });
  const [bolumMat, bolumTur] = await tablo(
    "deneme bölümleri",
    ADM,
    "POST",
    "exam_sections",
    [
      {
        organization_id: org,
        exam_id: deneme.id,
        subject_id: mat,
        name: "Matematik",
        question_count: 40,
        position: 1,
      },
      {
        organization_id: org,
        exam_id: deneme.id,
        subject_id: tur,
        name: "Türkçe",
        question_count: 40,
        position: 2,
      },
    ]
  );
  const netler = [
    ["1001", 28, 8, 33, 5],
    ["1002", 22, 10, 30, 6],
    ["1003", 18, 12, 27, 9],
    ["1004", 34, 4, 35, 3],
    ["1005", 15, 14, 25, 10],
  ];
  await rpc("deneme netleri", ADM, "record_exam_section_results", {
    target_exam_id: deneme.id,
    entries: netler.flatMap(([no, md, my, td, ty]) => [
      { student_id: ogr[no], section_id: bolumMat.id, correct: md, wrong: my },
      { student_id: ogr[no], section_id: bolumTur.id, correct: td, wrong: ty },
    ]),
  });

  // Ödeme: Deniz için üç taksit, ilki ödenmiş.
  const plan = await rpc("ödeme planı", ADM, "save_payment_plan", {
    p_organization_id: org,
    p_plan_id: null,
    p_student_id: ogr["1001"],
    p_name: "Yıllık kayıt",
    p_total_amount: 30000,
    p_installments: [
      { due_date: gun(-20), amount: 10000 },
      { due_date: gun(10), amount: 10000 },
      { due_date: gun(40), amount: 10000 },
    ],
  });
  const planId = typeof plan === "string" ? plan : plan?.id;
  const [ilkTaksit] = await tablo(
    "taksitler",
    ADM,
    "GET",
    `installments?plan_id=eq.${planId}&order=sequence_no&limit=1&select=id`
  );
  await tablo(
    "ilk taksit ödendi",
    ADM,
    "PATCH",
    `installments?id=eq.${ilkTaksit.id}`,
    { paid_at: new Date().toISOString() }
  );

  // İletişim: iki duyuru ve veliden öğretmene bir mesaj.
  await tablo("duyurular", ADM, "POST", "daily_feed_posts", [
    {
      organization_id: org,
      title: "Deneme takvimi açıklandı",
      body: "Dönem boyunca her ayın ilk cumartesi TYT denemesi yapılacak.",
      audience: "all",
      kind: "general",
    },
    {
      organization_id: org,
      title: "Veli toplantısı",
      body: "Gelecek hafta cuma 18.00'de veli toplantısı yapılacaktır.",
      audience: "guardians",
      kind: "general",
    },
  ]);
  const konusma = await rpc(
    "mesaj başlatma",
    veliHesap.jeton,
    "start_conversation",
    { target_membership_id: murat.uyelik }
  );
  await rpc("mesaj", veliHesap.jeton, "send_message", {
    target_conversation_id: konusma,
    message_body: "Merhaba, Deniz bu hafta ödevi teslim edecek.",
  });

  console.log("\n[tohum] Örnek Dershane kuruldu. Giriş bilgileri:\n");
  for (const [rol, giris] of hesaplar)
    console.log(`  ${rol.padEnd(38)} ${giris}`);
  console.log(
    `\n  Şifre hepsinde aynı: ${process.env.ORBIT_YEREL_SIFRE ? "ORBIT_YEREL_SIFRE'de verdiğiniz değer" : "README → Yerel kurulum"}.`
  );
}

try {
  await tohumla();
} catch (error) {
  if (error instanceof TohumHatasi) {
    console.error(`[tohum] Durdu — ${error.message}`);
    console.error(
      "Yarım kalan veriyi temizlemek için: supabase db reset, sonra yeniden pnpm yerel:tohum."
    );
    process.exit(1);
  }
  throw error;
}
