// Push notifications, with no extra packages.
//   iOS:     straight to Apple (APNs) using the .p8 key from App Store Connect.
//   Android: Firebase Cloud Messaging (FCM HTTP v1) using a service account.
// Each half switches itself on only when its settings exist in Vercel, so a
// missing key just skips that platform instead of breaking anything.
//
// Vercel environment variables:
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (the .p8 file contents, or base64 of it)
//   APNS_BUNDLE_ID (optional, defaults to com.diasporadirect.app)
//   FCM_SERVICE_ACCOUNT (the Firebase service account JSON, or base64 of it)
import crypto from "node:crypto";
import http2 from "node:http2";

const BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.diasporadirect.app";

function maybeBase64(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (v.startsWith("-----BEGIN") || v.startsWith("{")) return v;
  try { return Buffer.from(v, "base64").toString("utf8"); } catch { return v; }
}

const b64url = (input) => Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

// ---------- Apple ----------
let apnsJwt = { token: "", at: 0 };
function apnsToken() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = maybeBase64(process.env.APNS_KEY);
  if (!keyId || !teamId || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt.token && now - apnsJwt.at < 50 * 60) return apnsJwt.token;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  apnsJwt = { token: `${header}.${claims}.${b64url(signature)}`, at: now };
  return apnsJwt.token;
}

function sendApns(deviceToken, { title, body, data }) {
  const jwt = apnsToken();
  if (!jwt) return Promise.resolve({ skipped: true });
  return new Promise((resolve) => {
    let client;
    try {
      client = http2.connect("https://api.push.apple.com");
    } catch (e) {
      resolve({ error: e.message });
      return;
    }
    client.on("error", (e) => resolve({ error: e.message }));
    const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, ...(data || {}) });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let text = "";
    req.on("response", (headers) => { status = headers[":status"]; });
    req.setEncoding("utf8");
    req.on("data", (chunk) => { text += chunk; });
    req.on("end", () => {
      client.close();
      if (status === 200) { resolve({ sent: true }); return; }
      let reason = "";
      try { reason = JSON.parse(text).reason || ""; } catch {}
      resolve({ error: `${status} ${reason}`, invalid: status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" });
    });
    req.on("error", (e) => { client.close(); resolve({ error: e.message }); });
    req.end(payload);
  });
}

// ---------- Firebase (Android) ----------
let fcmAuth = { token: "", exp: 0, projectId: "" };
async function fcmAccessToken() {
  const raw = maybeBase64(process.env.FCM_SERVICE_ACCOUNT);
  if (!raw) return null;
  let sa;
  try { sa = JSON.parse(raw); } catch { console.error("FCM_SERVICE_ACCOUNT is not valid JSON"); return null; }
  const now = Math.floor(Date.now() / 1000);
  if (fcmAuth.token && fcmAuth.exp - 60 > now) return fcmAuth;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), sa.private_key);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!json.access_token) { console.error("FCM auth failed", resp.status, json); return null; }
  fcmAuth = { token: json.access_token, exp: now + (json.expires_in || 3600), projectId: sa.project_id };
  return fcmAuth;
}

async function sendFcm(deviceToken, { title, body, data }) {
  const auth = await fcmAccessToken();
  if (!auth) return { skipped: true };
  const stringData = {};
  Object.entries(data || {}).forEach(([k, v]) => { if (v != null) stringData[k] = String(v); });
  const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        data: stringData,
        android: { priority: "high", notification: { sound: "default" } },
      },
    }),
  });
  if (resp.ok) return { sent: true };
  const text = await resp.text();
  return { error: `${resp.status} ${text.slice(0, 200)}`, invalid: resp.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*token/i.test(text) };
}

// ---------- Public helpers ----------
// Sends to every phone registered to these profiles. Never throws.
export async function pushToProfiles(admin, profileIds, message) {
  try {
    const ids = [...new Set((profileIds || []).filter(Boolean))];
    if (!admin || ids.length === 0) return;
    const { data: tokens } = await admin.from("push_tokens").select("token, platform").in("profile_id", ids);
    if (!tokens || tokens.length === 0) return;
    await Promise.all(tokens.map(async (t) => {
      const result = t.platform === "ios" ? await sendApns(t.token, message) : await sendFcm(t.token, message);
      if (result.error) console.error("Push failed", t.platform, result.error);
      if (result.invalid) await admin.from("push_tokens").delete().eq("token", t.token);
    }));
  } catch (e) {
    console.error("Push failed", e);
  }
}

export async function pushToAdmins(admin, message) {
  const { data } = await admin.from("profiles").select("id").eq("role", "admin");
  return pushToProfiles(admin, (data || []).map((p) => p.id), message);
}

export async function pushToAgent(admin, agentId, message) {
  if (!agentId) return;
  const { data } = await admin.from("agents").select("profile_id").eq("id", agentId).maybeSingle();
  return pushToProfiles(admin, [data && data.profile_id], message);
}

export async function pushToApprovedAgents(admin, message) {
  const { data } = await admin.from("agents").select("profile_id").eq("approved", true);
  return pushToProfiles(admin, (data || []).map((a) => a.profile_id), message);
}
