/**
 * Cloudflare Worker for Paula Docce requests.
 * Required D1 binding: DB
 * D1 table: pauladocce_pozadavky
 *
 * API: POST { action: "create", message: "..." }
 *      POST { action: "list" }
 * Protect the Worker with Cloudflare Access before enabling list in production.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json({ ok: false, error: "Použijte metodu POST." }, 405);
    if (!env.DB) return json({ ok: false, error: "Chybí D1 binding DB." }, 500);

    let body;
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "Tělo požadavku musí být platný JSON." }, 400); }

    if (body.action === "create") {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return json({ ok: false, error: "Zpráva nesmí být prázdná." }, 400);
      if (message.length > 5000) return json({ ok: false, error: "Zpráva je příliš dlouhá (max. 5000 znaků)." }, 400);
      const result = await env.DB.prepare(
        "INSERT INTO pauladocce_pozadavky (message, status, created_at) VALUES (?, ?, datetime('now'))"
      ).bind(message, "Nová").run();
      return json({ ok: true, data: { id: result.meta?.last_row_id ?? null, message, status: "Nová", created_at: new Date().toISOString() } }, 201);
    }

    if (body.action === "list") {
      // This endpoint returns private admin data. Protect the Worker with Cloudflare Access.
      const result = await env.DB.prepare(
        "SELECT id, message, status, created_at FROM pauladocce_pozadavky ORDER BY created_at DESC, id DESC LIMIT 500"
      ).all();
      return json({ ok: true, data: result.results ?? [] });
    }

    return json({ ok: false, error: "Neznámá akce. Použijte create nebo list." }, 400);
  },
};
