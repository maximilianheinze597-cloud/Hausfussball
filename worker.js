export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // =========================================
    // CORS
    // =========================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    const url = new URL(request.url);

    // =========================================
    // TEST
    // =========================================

    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {

      return json({
        ok: true,
        app: "Hausfussball",
        message: "Hausfussball API läuft",
        pushConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON)
      }, cors);

    }


    // =========================================
    // FIREBASE PUSH REGISTRATION
    // POST /api/push/subscribe
    // DELETE /api/push/subscribe
    // =========================================
    if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (token.length < 100 || token.length > 8192) {
          return json({ ok: false, error: "Ungültiges Firebase-Geräte-Token." }, cors, 400);
        }
        await ensurePushTable(env);
        await env.DB.prepare(
          "INSERT INTO push_tokens (token, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT(token) DO UPDATE SET updated_at = excluded.updated_at"
        ).bind(token, Date.now(), Date.now()).run();
        return json({ ok: true, registered: true }, cors);
      } catch (error) {
        console.error("POST /api/push/subscribe:", error);
        return json({ ok: false, error: "Push-Token konnte nicht gespeichert werden." }, cors, 500);
      }
    }

    if (url.pathname === "/api/push/subscribe" && request.method === "DELETE") {
      try {
        const body = await request.json();
        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (token) {
          await ensurePushTable(env);
          await env.DB.prepare("DELETE FROM push_tokens WHERE token = ?").bind(token).run();
        }
        return json({ ok: true, removed: true }, cors);
      } catch (error) {
        console.error("DELETE /api/push/subscribe:", error);
        return json({ ok: false, error: "Push-Token konnte nicht entfernt werden." }, cors, 500);
      }
    }

    if (url.pathname === "/api/push-status" && request.method === "GET") {
      try {
        await ensurePushTable(env);
        const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_tokens").first();
        return json({
          ok: true,
          provider: "Firebase Cloud Messaging",
          configured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON),
          registeredDevices: Number(row?.count || 0)
        }, cors);
      } catch (error) {
        return json({ ok: false, error: "Push-Status nicht verfügbar." }, cors, 500);
      }
    }

    // =========================================
    // SPIELSTAND LADEN
    // GET /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "GET"
    ) {

      try {

        const row = await env.DB.prepare(`
          SELECT data
          FROM match_state
          WHERE id = 1
        `).first();

        if (!row) {

          const initialState = createInitialState();

          await env.DB.prepare(`
            INSERT INTO match_state (id, data)
            VALUES (1, ?)
          `)
          .bind(JSON.stringify(initialState))
          .run();

          return json({
            ok: true,
            state: initialState
          }, cors);

        }

        let state;

        try {
          state = JSON.parse(row.data);
        } catch {
          state = createInitialState();
        }

        state = normalizeState(state);

        return json({
          ok: true,
          state
        }, cors);

      } catch (error) {

        console.error(
          "GET /api/state:",
          error
        );

        return json({
          ok: false,
          error: error.message
        }, cors, 500);

      }

    }


    // =========================================
    // SPIELSTAND SPEICHERN
    // POST /api/event
    // =========================================

    if (
      url.pathname === "/api/event" &&
      request.method === "POST"
    ) {

      try {

        const body = await request.json();

        // -----------------------------------------
        // ALTE VERSION AUS DER DB LADEN
        // -----------------------------------------

        const row = await env.DB.prepare(`
          SELECT data
          FROM match_state
          WHERE id = 1
        `).first();

        let oldState;

        if (row) {

          try {
            oldState = normalizeState(
              JSON.parse(row.data)
            );
          } catch {
            oldState = createInitialState();
          }

        } else {

          oldState = createInitialState();

        }


        // -----------------------------------------
        // NEUEN STATE AUS REQUEST
        // -----------------------------------------

        let state;

        if (
          body.state &&
          typeof body.state === "object"
        ) {

          state =
            normalizeState(body.state);

        } else {

          state =
            normalizeState(oldState);

        }


        // -----------------------------------------
        // SCORES
        // -----------------------------------------

        if (
          typeof body.home === "number"
        ) {

          state.homeScore =
            body.home;

        }

        if (
          typeof body.away === "number"
        ) {

          state.awayScore =
            body.away;

        }


        // -----------------------------------------
        // FALLS EVENT DIREKT GESCHICKT WIRD
        // -----------------------------------------

        if (
          body.event &&
          typeof body.event === "object"
        ) {

          const event = {
            ...body.event
          };

          if (!event.timestamp) {
            event.timestamp = Date.now();
          }

          if (!event.id) {
            event.id = event.timestamp;
          }

          state.events.push(event);

        }


        // -----------------------------------------
        // EVENTS BEREINIGEN
        // -----------------------------------------

        const seen = new Set();

        state.events =
          state.events.filter(event => {

            const id =
              event.id ??
              event.timestamp;

            if (seen.has(id)) {
              return false;
            }

            seen.add(id);

            return true;

          });


        // -----------------------------------------
        // NEUE EVENTS ERMITTELN
        //
        // DAS IST DER WICHTIGE FIX.
        //
        // Deine index.html schickt den kompletten
        // state. Deshalb vergleichen wir den alten
        // DB-Stand mit dem neuen Stand.
        // -----------------------------------------

        const oldEventIds =
          new Set(
            oldState.events.map(
              event =>
                String(
                  event.id ??
                  event.timestamp
                )
            )
          );

        const newEvents =
          state.events.filter(event => {

            const id =
              String(
                event.id ??
                event.timestamp
              );

            return !oldEventIds.has(id);

          });


        // -----------------------------------------
        // SCORER NEU BERECHNEN
        // -----------------------------------------

        const scorers = {};

        for (
          const event of state.events
        ) {

          if (
            event.type === "goal" ||
            event.type === "penalty"
          ) {

            if (event.player) {

              if (!scorers[event.player]) {
                scorers[event.player] = 0;
              }

              scorers[event.player]++;

            }

          }

        }

        state.scorers = scorers;


        // -----------------------------------------
        // SPEICHERN
        // -----------------------------------------

        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(JSON.stringify(state))
        .run();


        // -----------------------------------------
        // PUSH FÜR NEUE EVENTS
        // -----------------------------------------

        const pushResults = [];

        for (
          const event of newEvents
        ) {

          const push =
            await sendPushForEvent(
              env,
              state,
              event
            );

          pushResults.push({
            eventId:
              event.id ??
              event.timestamp,

            type:
              event.type,

            push
          });

        }


        // -----------------------------------------
        // ANTWORT
        // -----------------------------------------

        return json({
          ok: true,
          state,
          newEvents,
          pushes: pushResults
        }, cors);


      } catch (error) {

        console.error(
          "Hausfussball API Fehler:",
          error
        );

        return json({
          ok: false,
          error: error.message
        }, cors, 400);

      }

    }


    // =========================================
    // SPIEL ZURÜCKSETZEN
    // DELETE /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "DELETE"
    ) {

      try {

        const initialState =
          createInitialState();

        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(
          JSON.stringify(initialState)
        )
        .run();

        return json({
          ok: true,
          state: initialState
        }, cors);

      } catch (error) {

        console.error(
          "DELETE /api/state:",
          error
        );

        return json({
          ok: false,
          error: error.message
        }, cors, 500);

      }

    }


    // =========================================
    // ROUTE NICHT GEFUNDEN
    // =========================================

    return json({
      ok: false,
      error: "Route nicht gefunden"
    }, cors, 404);

  }
};


// =====================================================
// INITIAL STATE
// =====================================================

function createInitialState() {

  return {

    homeTeam:
      "Heimteam",

    awayTeam:
      "Auswärtsteam",

    homeScore:
      0,

    awayScore:
      0,

    date:
      "",

    status:
      "not_started",

    startTime:
      null,

    elapsed:
      0,

    events:
      [],

    scorers:
      {}

  };

}


// =====================================================
// PUSH FÜR EVENT
// =====================================================

async function sendPushForEvent(
  env,
  state,
  event
) {

  const home =
    state.homeTeam ||
    "Heimteam";

  const away =
    state.awayTeam ||
    "Auswärtsteam";

  const minute =
    event.minute !== undefined
      ? `${event.minute}'`
      : "";

  let title =
    "⚽ Hausfussball";

  let body =
    "";

  let topic =
    "hausfussball";


  // =========================================
  // TOR
  // =========================================

  if (
    event.type === "goal"
  ) {

    const team =
      event.team === "home"
        ? home
        : away;

    body =
      `⚽ TOR für ${team}! ` +
      `${home} ${state.homeScore}:${state.awayScore} ${away}` +
      (
        event.player
          ? ` • ${event.player}`
          : ""
      ) +
      (
        minute
          ? ` • ${minute}`
          : ""
      );

    topic =
      "hausfussball-tor";

  }


  // =========================================
  // ELFMETER
  // =========================================

  else if (
    event.type === "penalty"
  ) {

    const team =
      event.team === "home"
        ? home
        : away;

    body =
      `🟢 Elfmeter für ${team}! ` +
      `${home} ${state.homeScore}:${state.awayScore} ${away}` +
      (
        event.player
          ? ` • ${event.player}`
          : ""
      ) +
      (
        minute
          ? ` • ${minute}`
          : ""
      );

    topic =
      "hausfussball-tor";

  }


  // =========================================
  // ANPFIFF
  // =========================================

  else if (
    event.type === "system" &&
    event.title === "Anpfiff"
  ) {

    body =
      `⚽ Anpfiff! ${home} gegen ${away}`;

    topic =
      "hausfussball-spiel";

  }


  // =========================================
  // HALBZEIT
  // =========================================

  else if (
    event.type === "system" &&
    event.title === "Halbzeit"
  ) {

    body =
      `⏸️ Halbzeit: ${home} ${state.homeScore}:${state.awayScore} ${away}`;

    topic =
      "hausfussball-spiel";

  }


  // =========================================
  // ABPFIFF
  // =========================================

  else if (
    event.type === "system" &&
    event.title === "Abpfiff"
  ) {

    body =
      `🏁 Abpfiff: ${home} ${state.homeScore}:${state.awayScore} ${away}`;

    topic =
      "hausfussball-spiel";

  }


  // =========================================
  // GELB
  // =========================================

  else if (
    event.type === "yellow"
  ) {

    body =
      `🟨 Gelbe Karte` +
      (
        event.player
          ? ` für ${event.player}`
          : ""
      ) +
      (
        minute
          ? ` • ${minute}`
          : ""
      );

    topic =
      "hausfussball-ereignis";

  }


  // =========================================
  // ROT
  // =========================================

  else if (
    event.type === "red"
  ) {

    body =
      `🟥 Rote Karte` +
      (
        event.player
          ? ` für ${event.player}`
          : ""
      ) +
      (
        minute
          ? ` • ${minute}`
          : ""
      );

    topic =
      "hausfussball-ereignis";

  }


  // =========================================
  // SONSTIGE
  // =========================================

  else {

    body =
      `${event.icon || "⚽"} ` +
      `${event.title || "Neues Ereignis"}` +
      (
        event.player
          ? ` • ${event.player}`
          : ""
      ) +
      (
        minute
          ? ` • ${minute}`
          : ""
      );

    topic =
      "hausfussball-ereignis";

  }


  return await sendFirebasePush(
    env,
    title,
    body,
    topic
  );

}


// =====================================================
// FIREBASE CLOUD MESSAGING SEND
// Cloudflare secret: FIREBASE_SERVICE_ACCOUNT_JSON
// =====================================================
let cachedFcmAccessToken = "";
let cachedFcmTokenExpiresAt = 0;
let cachedFcmProjectId = "";

async function ensurePushTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlFromText(value) {
  return base64UrlFromBytes(new TextEncoder().encode(value));
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getFcmAccessToken(env) {
  if (cachedFcmAccessToken && Date.now() < cachedFcmTokenExpiresAt - 60000) {
    return { token: cachedFcmAccessToken, projectId: cachedFcmProjectId };
  }
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Firebase ist nicht konfiguriert: FIREBASE_SERVICE_ACCOUNT_JSON fehlt.");
  }

  let account;
  try {
    account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON.");
  }
  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new Error("Firebase-Service-Account benötigt client_email, private_key und project_id.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlFromText(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsignedJwt = header + "." + claims;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const assertion = unsignedJwt + "." + base64UrlFromBytes(new Uint8Array(signature));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    console.error("Firebase OAuth fehlgeschlagen:", result.error || response.status);
    throw new Error("Firebase konnte kein Zugriffstoken ausstellen.");
  }
  cachedFcmAccessToken = result.access_token;
  cachedFcmTokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
  cachedFcmProjectId = account.project_id;
  return { token: cachedFcmAccessToken, projectId: cachedFcmProjectId };
}

async function sendFirebasePush(env, title, body, topic) {
  try {
    await ensurePushTable(env);
    const rows = await env.DB.prepare("SELECT token FROM push_tokens").all();
    const tokens = (rows.results || []).map(row => row.token).filter(Boolean);
    if (!tokens.length) {
      return { ok: true, provider: "fcm", delivered: 0, message: "Noch keine Geräte registriert." };
    }
    const auth = await getFcmAccessToken(env);
    const results = await Promise.all(tokens.map(async token => {
      const response = await fetch(
        "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(auth.projectId) + "/messages:send",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + auth.token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { topic: String(topic || "hausfussball"), url: "https://maximilianheinze597-cloud.github.io/Hausfussball/" },
              webpush: {
                headers: { Urgency: "high", TTL: "86400" },
                fcmOptions: { link: "https://maximilianheinze597-cloud.github.io/Hausfussball/" }
              }
            }
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true };
      const errorText = JSON.stringify(payload);
      if (response.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(errorText)) {
        await env.DB.prepare("DELETE FROM push_tokens WHERE token = ?").bind(token).run();
      }
      console.error("FCM Nachricht fehlgeschlagen:", response.status, errorText.slice(0, 500));
      return { ok: false, status: response.status };
    }));
    const delivered = results.filter(result => result.ok).length;
    return { ok: delivered > 0, provider: "fcm", delivered, failed: results.length - delivered };
  } catch (error) {
    console.error("Firebase Push Fehler:", error);
    return { ok: false, provider: "fcm", error: error.message };
  }
}

// =====================================================
// STATE NORMALISIEREN
// =====================================================

function normalizeState(
  state
) {

  const source =
    state &&
    typeof state === "object"
      ? state
      : {};


  return {

    homeTeam:
      typeof source.homeTeam === "string"
        ? source.homeTeam
        : "Heimteam",

    awayTeam:
      typeof source.awayTeam === "string"
        ? source.awayTeam
        : "Auswärtsteam",

    homeScore:
      Number.isFinite(
        Number(source.homeScore)
      )
        ? Number(source.homeScore)
        : 0,

    awayScore:
      Number.isFinite(
        Number(source.awayScore)
      )
        ? Number(source.awayScore)
        : 0,

    date:
      typeof source.date === "string"
        ? source.date
        : "",

    status:
      typeof source.status === "string"
        ? source.status
        : "not_started",

    startTime:
      source.startTime ??
      null,

    elapsed:
      Number.isFinite(
        Number(source.elapsed)
      )
        ? Number(source.elapsed)
        : 0,

    events:
      Array.isArray(source.events)
        ? source.events
        : [],

    scorers:
      source.scorers &&
      typeof source.scorers === "object"
        ? source.scorers
        : {}

  };

}


// =====================================================
// JSON HELFER
// =====================================================

function json(
  data,
  cors,
  status = 200
) {

  return new Response(

    JSON.stringify(data),

    {

      status,

      headers: {

        "Content-Type":
          "application/json; charset=UTF-8",

        ...cors

      }

    }

  );

}
