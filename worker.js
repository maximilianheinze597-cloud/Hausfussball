export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
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
        pushConfigured: Boolean(env.LITEPUSH_API_KEY)
      }, cors);
    }


    // =========================================
    // PUSH TEST
    // GET /api/push-test
    // =========================================

    if (
      url.pathname === "/api/push-test" &&
      request.method === "GET"
    ) {

      const result = await sendLitePush(
        env,
        "⚽ Hausfussball Test",
        "Push-Benachrichtigungen funktionieren!",
        "push-test"
      );

      return json({
        ok: result.ok,
        push: result
      }, cors, result.ok ? 200 : 500);
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

          const initialState = {
            homeTeam: "Heimteam",
            awayTeam: "Auswärtsteam",

            homeScore: 0,
            awayScore: 0,

            date: "",

            status: "not_started",

            startTime: null,

            elapsed: 0,

            events: [],

            scorers: {}
          };

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
          state = {};
        }

        state = normalizeState(state);

        return json({
          ok: true,
          state
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 500);

      }
    }


    // =========================================
    // KOMPLETTEN SPIELSTAND SPEICHERN
    // POST /api/event
    // =========================================

    if (
      url.pathname === "/api/event" &&
      request.method === "POST"
    ) {

      try {

        const body = await request.json();

        // -----------------------------------------
        // Aktuellen Stand laden
        // -----------------------------------------

        const row = await env.DB.prepare(`
          SELECT data
          FROM match_state
          WHERE id = 1
        `).first();

        let currentState;

        if (row) {

          try {
            currentState = JSON.parse(row.data);
          } catch {
            currentState = normalizeState({});
          }

        } else {

          currentState = normalizeState({});

        }


        // -----------------------------------------
        // Neuen Stand bestimmen
        // -----------------------------------------

        let state;

        if (
          body.state &&
          typeof body.state === "object"
        ) {

          state = normalizeState(body.state);

        } else {

          state = normalizeState(currentState);

        }


        // -----------------------------------------
        // Separate Scores
        // -----------------------------------------

        if (
          typeof body.home === "number"
        ) {
          state.homeScore = body.home;
        }

        if (
          typeof body.away === "number"
        ) {
          state.awayScore = body.away;
        }


        // -----------------------------------------
        // Ereignis hinzufügen
        // -----------------------------------------

        let addedEvent = null;

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

          addedEvent = event;
        }


        // -----------------------------------------
        // Doppelte Events entfernen
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
        // Scorer neu berechnen
        // -----------------------------------------

        const scorers = {};

        for (const event of state.events) {

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
        // SPIELSTAND SPEICHERN
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
        // PUSH SENDEN
        // -----------------------------------------

        let push = null;

        if (addedEvent) {

          push = await sendPushForEvent(
            env,
            state,
            addedEvent
          );

        }


        // -----------------------------------------
        // ANTWORT
        // -----------------------------------------

        return json({
          ok: true,
          state,
          push
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
    // SPIEL KOMPLETT ZURÜCKSETZEN
    // DELETE /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "DELETE"
    ) {

      try {

        const initialState = {
          homeTeam: "Heimteam",
          awayTeam: "Auswärtsteam",

          homeScore: 0,
          awayScore: 0,

          date: "",

          status: "not_started",

          startTime: null,

          elapsed: 0,

          events: [],

          scorers: {}
        };


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(JSON.stringify(initialState))
        .run();


        return json({
          ok: true,
          state: initialState
        }, cors);


      } catch (error) {

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
// LITEPUSH
// =====================================================

async function sendPushForEvent(
  env,
  state,
  event
) {

  let title = "⚽ Hausfussball";
  let body = "";
  let topic = "hausfussball";

  const home = state.homeTeam || "Heimteam";
  const away = state.awayTeam || "Auswärtsteam";

  const minute =
    event.minute !== undefined
      ? `${event.minute}'`
      : "";


  // -----------------------------------------
  // TOR
  // -----------------------------------------

  if (event.type === "goal") {

    const team =
      event.team === "home"
        ? home
        : away;

    body =
      `⚽ TOR für ${team}! ` +
      `${home} ${state.homeScore}:${state.awayScore} ${away}` +
      (minute ? ` • ${minute}` : "");

    topic = "hausfussball-tor";

  }


  // -----------------------------------------
  // ELFMETER
  // -----------------------------------------

  else if (event.type === "penalty") {

    const team =
      event.team === "home"
        ? home
        : away;

    body =
      `🟢 Elfmeter für ${team}! ` +
      `${home} ${state.homeScore}:${state.awayScore} ${away}` +
      (minute ? ` • ${minute}` : "");

    topic = "hausfussball-tor";

  }


  // -----------------------------------------
  // ANPFIFF
  // -----------------------------------------

  else if (
    event.type === "system" &&
    event.title === "Anpfiff"
  ) {

    body =
      `⚽ Anpfiff! ${home} gegen ${away}`;

    topic = "hausfussball-spiel";

  }


  // -----------------------------------------
  // HALBZEIT
  // -----------------------------------------

  else if (
    event.type === "system" &&
    event.title === "Halbzeit"
  ) {

    body =
      `⏸️ Halbzeit: ${home} ${state.homeScore}:${state.awayScore} ${away}`;

    topic = "hausfussball-spiel";

  }


  // -----------------------------------------
  // ABPFIFF
  // -----------------------------------------

  else if (
    event.type === "system" &&
    event.title === "Abpfiff"
  ) {

    body =
      `🏁 Abpfiff: ${home} ${state.homeScore}:${state.awayScore} ${away}`;

    topic = "hausfussball-spiel";

  }


  // -----------------------------------------
  // GELB
  // -----------------------------------------

  else if (event.type === "yellow") {

    body =
      `🟨 Gelbe Karte` +
      (event.player
        ? ` für ${event.player}`
        : "") +
      (minute ? ` • ${minute}` : "");

    topic = "hausfussball-ereignis";

  }


  // -----------------------------------------
  // ROT
  // -----------------------------------------

  else if (event.type === "red") {

    body =
      `🟥 Rote Karte` +
      (event.player
        ? ` für ${event.player}`
        : "") +
      (minute ? ` • ${minute}` : "");

    topic = "hausfussball-ereignis";

  }


  // -----------------------------------------
  // SONSTIGE EREIGNISSE
  // -----------------------------------------

  else {

    const eventName =
      event.title ||
      "Neues Ereignis";

    body =
      `${event.icon || "⚽"} ${eventName}` +
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

    topic = "hausfussball-ereignis";

  }


  return await sendLitePush(
    env,
    title,
    body,
    topic
  );

}


// =====================================================
// LITEPUSH SEND
// =====================================================

async function sendLitePush(
  env,
  title,
  body,
  topic
) {

  // -----------------------------------------
  // API KEY PRÜFEN
  // -----------------------------------------

  if (!env.LITEPUSH_API_KEY) {

    console.error(
      "LITEPUSH_API_KEY fehlt."
    );

    return {
      ok: false,
      error: "LITEPUSH_API_KEY fehlt"
    };

  }


  try {

    const response =
      await fetch(
        "https://api.litepush.dev/v1/send",
        {
          method:"POST",

          headers:{
            "Authorization":
              `Bearer ${env.LITEPUSH_API_KEY}`,

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body:JSON.stringify({

            target:{
              type:"all"
            },

            notification:{

              title:title,

              body:body,

              url:
                "https://hausfussball-live.maximilianheinze597.workers.dev/"

            },

            urgency:"high",

            ttl:86400,

            topic:topic

          })

        }
      );


    const text =
      await response.text();


    let result = null;

    try {

      result =
        text
          ? JSON.parse(text)
          : null;

    } catch {

      result = {
        raw:text
      };

    }


    if(!response.ok){

      console.error(
        "LitePush Fehler:",
        response.status,
        result
      );

      return {
        ok:false,
        status:response.status,
        response:result
      };

    }


    console.log(
      "LitePush erfolgreich:",
      result
    );


    return {
      ok:true,
      status:response.status,
      response:result
    };


  } catch(error){

    console.error(
      "LitePush Verbindung fehlgeschlagen:",
      error
    );

    return {
      ok:false,
      error:error.message
    };

  }

}


// =====================================================
// STATE NORMALISIEREN
// =====================================================

function normalizeState(state){

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
      typeof source.homeScore === "number"
        ? source.homeScore
        : 0,

    awayScore:
      typeof source.awayScore === "number"
        ? source.awayScore
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
      source.startTime ?? null,

    elapsed:
      typeof source.elapsed === "number"
        ? source.elapsed
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
){

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers:{
        "Content-Type":
          "application/json; charset=UTF-8",

        ...cors
      }
    }
  );

}
