export interface Env {
  DB: D1Database;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ service: "omnipoint-migration-api", status: result?.ok === 1 ? "ok" : "degraded" });
      } catch {
        return json({ service: "omnipoint-migration-api", status: "database_unavailable" }, 503);
      }
    }

    // Deliberately no unauthenticated business-data endpoints or write operations.
    // Authentication and role checks must be implemented before exposing records.
    return json({ error: "not_found" }, 404);
  },
};
