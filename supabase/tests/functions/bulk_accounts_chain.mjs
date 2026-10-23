#!/usr/bin/env node
// Toplu hesap açma zinciri (2026-10-23, ana plan 1.8):
// HTTP → JWT → create-members-bulk → RLS ile kayıt okuma → hesap → bağlama.
//
// Neden pgTAP değil: auth kullanıcısı GoTrue API'siyle açılıyor (bkz.
// create_member_chain.sh). Bu test GERÇEK satır yazar; başta ve sonda temizler.
//
// Ölçtükleri — fonksiyonun güvenlik iddiaları:
//   1. Yönetici: hesabı olmayan öğrencilere ve velilerine hesap açılır ve bağlanır;
//      iki kardeşin ortak velisi TEK hesap alır.
//   2. ⛔ Başka kurumun öğrencisi: görünmez → not_found, hesap açılmaz.
//   3. ⛔ Hesabı olan kayda ikinci hesap açılmaz.
//   4. ⛔ Öğretmen çağırırsa hiçbir hesap açılmaz.
//   5. Tekrarlanan istek (aynı anahtar) işi yinelemez ve şifre döndürmez.
//
// Kullanım (depo kökünden, `supabase start` ayaktayken):
//   node supabase/tests/functions/bulk_accounts_chain.mjs
// Anahtarlar `supabase status -o env`'den; CLI yolu SUPABASE_CLI ile verilebilir.

import { execSync } from "node:child_process";

const cli =
  process.env.SUPABASE_CLI ||
  (() => {
    try {
      execSync("supabase --version", { stdio: "ignore" });
      return "supabase";
    } catch {
      return "npx --yes supabase";
    }
  })();
const env = Object.fromEntries(
  execSync(`${cli} status -o env`, { encoding: "utf8" })
    .split(/\r?\n/)
    .map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(m => [m[1], m[2]])
);
const API = env.API_URL;
const ANON = env.ANON_KEY || env.PUBLISHABLE_KEY;
const SERVICE = env.SERVICE_ROLE_KEY || env.SECRET_KEY;
if (!API || !ANON || !SERVICE) throw new Error("supabase status okunamadı");

const PASSWORD = "Orbit2026Test";
const ORG = { code: 9902, slug: "orbit-toplu-zincir" };
const FOREIGN = { code: 9903, slug: "orbit-toplu-yabanci" };
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

function fail(message) {
  console.error(`HATA: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

// `token` verilmezse service_role; verilirse o kullanıcı olarak (RLS altında).
// Kurum verisi (öğrenci, veli, bağ) yönetici olarak yazılır: CI'daki eski CLI
// sürümünde service_role `search_fold`'u çalıştıramıyor (canlıda ve yerelde
// varsayılan yetkiyle çalıştırıyor) — test o farka bağlı kalmasın, 2026-10-23.
async function rest(method, path, body, token) {
  const response = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      ...(token ? { apikey: ANON, Authorization: `Bearer ${token}` } : svc),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    fail(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function createAuthUser(email) {
  const response = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const user = await response.json();
  if (!user.id) fail(`auth kullanıcısı açılamadı: ${email}`);
  return user.id;
}

async function signIn(email) {
  const response = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await response.json();
  if (!session.access_token) fail(`giriş yapılamadı: ${email}`);
  return session.access_token;
}

async function bulk(token, studentIds, key) {
  const response = await fetch(`${API}/functions/v1/create-members-bulk`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ studentIds, includeGuardians: true }),
  });
  return { status: response.status, body: await response.json() };
}

async function cleanup() {
  for (const org of [ORG, FOREIGN]) {
    const [row] = await rest(
      "GET",
      `organizations?code=eq.${org.code}&select=id`
    );
    if (!row) continue;
    const members = await rest(
      "GET",
      `organization_memberships?organization_id=eq.${row.id}&select=user_id`
    );
    for (const table of [
      "student_guardians",
      "students",
      "guardians",
      "audit_events",
      "organization_memberships",
      "branches",
    ])
      await rest("DELETE", `${table}?organization_id=eq.${row.id}`);
    await rest("DELETE", `organizations?id=eq.${row.id}`);
    for (const { user_id: id } of members) {
      await rest("DELETE", `internal_function_calls?caller_user_id=eq.${id}`);
      await fetch(`${API}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: svc,
      });
    }
  }
}

async function setupOrg(org, name) {
  const [o] = await rest("POST", "organizations", {
    name,
    slug: org.slug,
    code: org.code,
  });
  const [b] = await rest("POST", "branches", {
    organization_id: o.id,
    name: "Merkez",
    is_default: true,
  });
  return { orgId: o.id, branchId: b.id };
}

try {
  await cleanup();
  console.log("0/6 temiz başlangıç");

  const { orgId, branchId } = await setupOrg(ORG, "Toplu Zincir Dershanesi");
  const foreign = await setupOrg(FOREIGN, "Yabancı Dershane");

  const adminEmail = `${ORG.code}1000@orbit.invalid`;
  const teacherEmail = `${ORG.code}1001@orbit.invalid`;
  const adminId = await createAuthUser(adminEmail);
  const teacherId = await createAuthUser(teacherEmail);
  await rest("POST", "organization_memberships", [
    {
      organization_id: orgId,
      branch_id: branchId,
      user_id: adminId,
      role: "admin",
      status: "active",
      person_code: 1000,
    },
    {
      organization_id: orgId,
      branch_id: branchId,
      user_id: teacherId,
      role: "teacher",
      status: "active",
      person_code: 1001,
    },
  ]);
  const foreignAdminEmail = `${FOREIGN.code}1000@orbit.invalid`;
  const foreignAdminId = await createAuthUser(foreignAdminEmail);
  await rest("POST", "organization_memberships", [
    {
      organization_id: foreign.orgId,
      branch_id: foreign.branchId,
      user_id: foreignAdminId,
      role: "admin",
      status: "active",
      person_code: 1000,
    },
  ]);

  const adminToken = await signIn(adminEmail);
  const teacherToken = await signIn(teacherEmail);
  const foreignAdminToken = await signIn(foreignAdminEmail);

  const students = await rest(
    "POST",
    "students",
    [
      {
        organization_id: orgId,
        branch_id: branchId,
        full_name: "Zincir Kardeş Bir",
      },
      {
        organization_id: orgId,
        branch_id: branchId,
        full_name: "Zincir Kardeş İki",
      },
    ],
    adminToken
  );
  const [foreignStudent] = await rest(
    "POST",
    "students",
    [
      {
        organization_id: foreign.orgId,
        branch_id: foreign.branchId,
        full_name: "Yabancı Öğrenci",
      },
    ],
    foreignAdminToken
  );
  const [guardian] = await rest(
    "POST",
    "guardians",
    [{ organization_id: orgId, full_name: "Zincir Ortak Veli" }],
    adminToken
  );
  await rest(
    "POST",
    "student_guardians",
    students.map(s => ({
      organization_id: orgId,
      student_id: s.id,
      guardian_id: guardian.id,
    })),
    adminToken
  );
  console.log(
    "1/6 iki kurum, yöneticiler, öğretmen, iki kardeş ve ortak veli hazır"
  );

  const ids = [...students.map(s => s.id), foreignStudent.id];

  // 4 · Öğretmen: hiçbir hesap açılmaz (önce, kayıtlar hâlâ hesapsızken)
  const asTeacher = await bulk(
    teacherToken,
    ids,
    `toplu-ogretmen-${Date.now()}`
  );
  const teacherCreated = (asTeacher.body?.data?.items ?? []).filter(
    i => i.status === "created"
  );
  if (teacherCreated.length !== 0)
    fail(`öğretmen ${teacherCreated.length} hesap açtı`);
  console.log(
    `2/6 ⛔ öğretmen hiçbir hesap açamadı (HTTP ${asTeacher.status})`
  );

  // 1–2 · Yönetici
  const key = `toplu-yonetici-${Date.now()}`;
  const first = await bulk(adminToken, ids, key);
  if (first.status !== 200)
    fail(
      `toplu çağrı HTTP ${first.status} ${JSON.stringify(first.body).slice(0, 200)}`
    );
  const items = first.body.data.items;
  const byId = Object.fromEntries(items.map(i => [i.recordId, i]));
  for (const s of students)
    if (
      byId[s.id]?.status !== "created" ||
      !byId[s.id].linked ||
      !byId[s.id].temporary_password
    )
      fail(
        `öğrenci hesabı açılıp bağlanmadı: ${JSON.stringify(byId[s.id] ?? null)}`
      );
  const guardianItems = items.filter(i => i.kind === "guardian");
  if (
    guardianItems.length !== 1 ||
    guardianItems[0].status !== "created" ||
    !guardianItems[0].linked
  )
    fail(`ortak veli tek hesap almadı: ${JSON.stringify(guardianItems)}`);
  if (byId[foreignStudent.id]?.status !== "not_found")
    fail(
      `başka kurumun öğrencisi görünür oldu: ${JSON.stringify(byId[foreignStudent.id] ?? null)}`
    );
  const linked = await rest(
    "GET",
    `students?id=in.(${students.map(s => s.id).join(",")})&select=auth_user_id`
  );
  if (linked.some(s => !s.auth_user_id))
    fail("öğrenci kaydı hesaba bağlanmamış");
  const [foreignAfter] = await rest(
    "GET",
    `students?id=eq.${foreignStudent.id}&select=auth_user_id`
  );
  if (foreignAfter.auth_user_id)
    fail("başka kurumun öğrencisine hesap bağlandı");
  console.log(
    "3/6 iki öğrenci + ortak veli tek hesap; ⛔ başka kurumun öğrencisi not_found"
  );

  // 5 · Tekrar: aynı anahtar
  const replay = await bulk(adminToken, ids, key);
  if (
    !replay.body?.data?.replayed ||
    JSON.stringify(replay.body).includes("temporary_password")
  )
    fail(
      `tekrar istek işi yineledi ya da şifre döndürdü: ${JSON.stringify(replay.body).slice(0, 200)}`
    );
  console.log("4/6 tekrar istek işi yinelemedi, şifre döndürmedi");

  // 3 · Yeni anahtarla aynı kayıtlar: ikinci hesap yok
  const usersBefore = (
    await rest(
      "GET",
      `organization_memberships?organization_id=eq.${orgId}&select=id`
    )
  ).length;
  const again = await bulk(adminToken, ids, `toplu-yeniden-${Date.now()}`);
  if (again.body.data.items.some(i => i.status === "created"))
    fail("hesabı olan kayda ikinci hesap açıldı");
  const usersAfter = (
    await rest(
      "GET",
      `organization_memberships?organization_id=eq.${orgId}&select=id`
    )
  ).length;
  if (usersAfter !== usersBefore)
    fail(`üye sayısı değişti: ${usersBefore} → ${usersAfter}`);
  console.log("5/6 ⛔ hesabı olan kayda ikinci hesap açılmadı");

  console.log("6/6 toplu hesap açma zinciri uçtan uca çalışıyor.");
} finally {
  await cleanup().catch(error => console.error("temizlik:", error.message));
  console.log("Test verisi temizlendi.");
}
