// Edge Function: OAuth Google Calendar proxy, stores refresh token server-side only.
// Configure Google OAuth client credentials as Supabase secrets:
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Never expose them to the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID"), clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!url || !anon || !service || !clientId || !clientSecret) return reply({ error: "Server integration is not configured" }, 503);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reply({ error: "Authentication required" }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return reply({ error: "Authentication required" }, 401);
  const admin = createClient(url, service);
  try {
    const body = await req.json();
    if (body.action === "connect") {
      if (typeof body.refresh_token !== "string" || body.refresh_token.length > 4096) return reply({ error: "Invalid OAuth token" }, 400);
      const { error } = await admin.from("mastreani_google_tokens").upsert({ owner_id: user.id, refresh_token: body.refresh_token, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
      if (error) throw error;
      return reply({ connected: true });
    }
    if (!new Set(["create", "update", "delete"]).has(body.action) || typeof body.history_id !== "string" || body.history_id.length > 100) return reply({ error: "Invalid operation" }, 400);
    const { data: eventRow, error: eventError } = await admin.from("mastreani_google_events").select("event_id").eq("owner_id", user.id).eq("history_id", body.history_id).maybeSingle();
    if (eventError) throw eventError;
    const eventId = typeof body.event_id === "string" && body.event_id ? body.event_id : (eventRow?.event_id || "");
    const { data: tokenRow, error: tokenError } = await admin.from("mastreani_google_tokens").select("refresh_token").eq("owner_id", user.id).maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.refresh_token) return reply({ error: "Google account not connected" }, 409);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: tokenRow.refresh_token, grant_type: "refresh_token" }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) return reply({ error: "Google authorization failed", detail: token.error || "unknown" }, 502);
    if (body.action === "delete") {
      if (eventId) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token.access_token}` } });
        if (!res.ok && res.status !== 404) throw new Error("Google Calendar delete failed");
      }
      await admin.from("mastreani_google_events").delete().eq("owner_id", user.id).eq("history_id", body.history_id);
      return reply({ deleted: true });
    }
    const occurred = new Date(body.occurred_at);
    if (Number.isNaN(occurred.getTime())) return reply({ error: "Invalid event time" }, 400);
    const start = new Date(occurred.getTime() - 30 * 60 * 1000), end = occurred;
    const event = { summary: `Contato CRM · ${String(body.client_name || "Cliente").slice(0, 120)} · ${String(body.type || "Contato").slice(0, 40)}`, description: [String(body.note || "").slice(0, 1000), String(body.city || "").slice(0, 120), `CRM history ID: ${body.history_id}`].filter(Boolean).join("\n"), start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
    const endpoint = eventId ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}` : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const response = await fetch(endpoint, { method: eventId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(event) });
    const result = await response.json();
    if (!response.ok) return reply({ error: "Google Calendar request failed", detail: result.error?.message || response.status }, 502);
    const { error: saveEventError } = await admin.from("mastreani_google_events").upsert({ owner_id: user.id, history_id: body.history_id, event_id: result.id, updated_at: new Date().toISOString() }, { onConflict: "owner_id,history_id" });
    if (saveEventError) throw saveEventError;
    return reply({ eventId: result.id });
  } catch (err) { return reply({ error: String(err?.message || "Unexpected server error") }, 500); }
});
