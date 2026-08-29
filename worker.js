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
        message: "Hausfussball API läuft"
      }, cors);
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
        // Aktuellen Stand aus Datenbank laden
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
        // WICHTIG:
        // Wenn die App "state" schickt,
        // übernehmen wir den KOMPLETTEN Spielstand.
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
        // Falls home/away separat geschickt wurden
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

          state.events.push(event);

        }


        // -----------------------------------------
        // Doppelte Events verhindern
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
        // Scorer automatisch aus Events erstellen
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
        // KOMPLETTEN SPIELSTAND SPEICHERN
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
        // Kontrolle: gespeicherten Stand zurückgeben
        // -----------------------------------------

        return json({
          ok: true,
          state
        }, cors);


      } catch (error) {

        console.error(error);

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


// =========================================
// STATE NORMALISIEREN
// =========================================

function normalizeState(state) {

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


// =========================================
// JSON HELFER
// =========================================

function json(data, cors, status = 200) {

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
