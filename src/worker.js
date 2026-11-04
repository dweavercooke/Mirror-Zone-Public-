// Handles the "Stay informed" signup form (POST /api/signup).
// Everything else is served from the static HTML files.

const SCHEMA = `CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization TEXT,
  role TEXT,
  sector_of_interest TEXT,
  state_of_interest TEXT
)`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/signup") {
      if (request.method !== "POST") {
        return Response.redirect(new URL("/#join", url), 303);
      }
      return handleSignup(request, env, url);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/signups.csv") {
      return handleAdmin(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSignup(request, env, url) {
  const back = (status) =>
    Response.redirect(new URL(`/?signup=${status}#join`, url), 303);

  let form;
  try {
    form = await request.formData();
  } catch {
    return back("error");
  }

  const field = (key, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);

  // Honeypot: real people never fill this hidden field. Pretend success for bots.
  if (field("bot-field")) {
    return Response.redirect(new URL("/thanks", url), 303);
  }

  const name = field("name");
  const email = field("email", 254).toLowerCase();
  if (!name || !EMAIL_RE.test(email)) return back("invalid");

  try {
    await env.DB.prepare(SCHEMA).run();
    await env.DB.prepare(
      `INSERT INTO signups (name, email, organization, role, sector_of_interest, state_of_interest)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         organization = excluded.organization,
         role = excluded.role,
         sector_of_interest = excluded.sector_of_interest,
         state_of_interest = excluded.state_of_interest`
    )
      .bind(
        name,
        email,
        field("organization") || null,
        field("role") || null,
        field("sector_of_interest") || null,
        field("state_of_interest") || null
      )
      .run();
  } catch (err) {
    console.error("Signup save failed", err);
    return back("error");
  }

  // Shows up in Cloudflare: Workers > mirror-zone-public > Logs (live)
  console.log(`NEW SIGNUP: ${name} <${email}>`, {
    organization: field("organization"),
    role: field("role"),
    sector: field("sector_of_interest"),
    state: field("state_of_interest"),
  });

  return Response.redirect(new URL("/thanks", url), 303);
}

// ---------- Private signups page: /admin (password = ADMIN_PASSWORD secret) ----------

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_PASSWORD) {
    return new Response("Admin page is not set up yet: add an ADMIN_PASSWORD secret in Cloudflare.", { status: 503 });
  }
  if (!(await isAuthorized(request, env.ADMIN_PASSWORD))) {
    return new Response("Sign in required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Mirror Zones signups", charset="UTF-8"' },
    });
  }

  let rows = [];
  try {
    await env.DB.prepare(SCHEMA).run();
    const result = await env.DB.prepare("SELECT * FROM signups ORDER BY created_at DESC").all();
    rows = result.results || [];
  } catch (err) {
    console.error("Admin read failed", err);
    return new Response("Could not read signups.", { status: 500 });
  }

  const cols = ["created_at", "name", "email", "organization", "role", "sector_of_interest", "state_of_interest"];
  const labels = ["Date (UTC)", "Name", "Email", "Organization", "Role", "Sector", "State"];
  const noStore = { "Cache-Control": "no-store" };

  if (url.pathname.endsWith(".csv")) {
    const csvCell = (v) => {
      let t = String(v ?? "");
      if (/^[=+\-@]/.test(t)) t = "'" + t; // stop spreadsheet formula injection
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const csv = [labels, ...rows.map((r) => cols.map((c) => r[c]))].map((line) => line.map(csvCell).join(",")).join("\r\n");
    return new Response("\ufeff" + csv, {
      headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mirror-zones-signups.csv"' },
    });
  }

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const body = rows.length
    ? rows.map((r) => "<tr>" + cols.map((c) => `<td>${esc(r[c])}</td>`).join("") + "</tr>").join("")
    : `<tr><td colspan="${cols.length}" class="empty">No signups yet.</td></tr>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Signups | Mirror Zones</title>
<style>
body{margin:0;background:#f5f1e7;color:#17263b;font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:32px 16px}
.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:20px}
h1{margin:0;font:400 32px/1.2 Spectral,Georgia,serif}
.count{color:#5c6675;margin:4px 0 0}
a.btn{padding:10px 18px;background:#17263b;color:#f5f1e7;text-decoration:none;font-weight:500}
a.btn:hover{background:#8a6a26}
.scroll{overflow-x:auto;background:#fbf9f3;border:1px solid #ddd5c2}
table{border-collapse:collapse;width:100%;min-width:800px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #ddd5c2;vertical-align:top}
th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5c6675;background:#ede6d5}
td.empty{text-align:center;color:#5c6675;padding:32px}
</style></head><body><div class="wrap">
<div class="top"><div><h1>Signups</h1><p class="count">${rows.length} total &middot; newest first</p></div>
<a class="btn" href="/admin/signups.csv">Download CSV</a></div>
<div class="scroll"><table><thead><tr>${labels.map((l) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>
</div></body></html>`;

  return new Response(html, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } });
}

async function isAuthorized(request, password) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let supplied = "";
  try {
    const decoded = atob(header.slice(6));
    supplied = decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return false;
  }
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(supplied)),
    crypto.subtle.digest("SHA-256", enc.encode(password)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}
