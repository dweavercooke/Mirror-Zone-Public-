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
const FORM_PAGE = "/option-e-new-design";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/signup") {
      if (request.method !== "POST") {
        return Response.redirect(new URL(FORM_PAGE + "#join", url), 303);
      }
      return handleSignup(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSignup(request, env, url) {
  const back = (status) =>
    Response.redirect(new URL(`${FORM_PAGE}?signup=${status}#join`, url), 303);

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

  return Response.redirect(new URL("/thanks", url), 303);
}
