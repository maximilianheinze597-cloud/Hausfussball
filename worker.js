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
    // STANDARD-SPIELSTAND
    // =========================================

    const defaultState = {
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


    // =========================================
    // SPIELSTAND ABRUFEN
    // GET /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "GET"
    ) {

      try {

        const result =
          await env.DB.prepare(`
            SELECT data
            FROM match_state
            WHERE id = 1
          `).first();


        // Noch kein Spielstand vorhanden

        if (!result) {

          await env.DB.prepare(`
            INSERT INTO match_state (id, data)
            VALUES (1, ?)
          `)
          .bind(
            JSON.stringify(defaultState)
          )
          .run();


          return json({
            ok: true,
            state: defaultState
          }, cors);

        }


        let state;


        try {

          state =
            JSON.parse(result.data);

        } catch {

          state =
            structuredClone(defaultState);

        }


        // Fehlende Felder ergänzen

        state = {
          ...structuredClone(defaultState),
          ...state,

          events:
            Array.isArray(state.events)
              ? state.events
              : [],

          scorers:
            state.scorers &&
            typeof state.scorers === "object"
              ? state.scorers
              : {}
        };


        return json({
          ok: true,
          state: state
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
    // POST /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "POST"
    ) {

      try {

        const incoming =
          await request.json();


        const state = {
          ...structuredClone(defaultState),
          ...incoming,

          events:
            Array.isArray(incoming.events)
              ? incoming.events
              : [],

          scorers:
            incoming.scorers &&
            typeof incoming.scorers === "object"
              ? incoming.scorers
              : {}
        };


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(
          JSON.stringify(state)
        )
        .run();


        return json({
          ok: true,
          state: state
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 400);

      }

    }


    // =========================================
    // EVENT HINZUFÜGEN
    // POST /api/event
    //
    // Unterstützt weiterhin die alte
    // Event-API.
    // =========================================

    if (
      url.pathname === "/api/event" &&
      request.method === "POST"
    ) {

      try {

        const incoming =
          await request.json();


        const current =
          await env.DB.prepare(`
            SELECT data
            FROM match_state
            WHERE id = 1
          `).first();


        let state =
          current
            ? JSON.parse(current.data)
            : structuredClone(defaultState);


        state = {
          ...structuredClone(defaultState),
          ...state,

          events:
            Array.isArray(state.events)
              ? state.events
              : [],

          scorers:
            state.scorers &&
            typeof state.scorers === "object"
              ? state.scorers
              : {}
        };


        // Optionalen kompletten Spielstand übernehmen

        if (
          typeof incoming.homeScore === "number"
        ) {

          state.homeScore =
            incoming.homeScore;

        }

        if (
          typeof incoming.awayScore === "number"
        ) {

          state.awayScore =
            incoming.awayScore;

        }


        // Alte API-Kompatibilität

        if (
          typeof incoming.home === "number"
        ) {

          state.homeScore =
            incoming.home;

        }

        if (
          typeof incoming.away === "number"
        ) {

          state.awayScore =
            incoming.away;

        }


        // Ereignis hinzufügen

        if (incoming.event) {

          state.events.push({

            ...incoming.event,

            timestamp:
              Date.now()

          });

        }


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(
          JSON.stringify(state)
        )
        .run();


        return json({
          ok: true,
          state: state
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 400);

      }

    }


    // =========================================
    // KOMPLETT ZURÜCKSETZEN
    // DELETE /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "DELETE"
    ) {

      try {

        const state =
          structuredClone(defaultState);


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(
          JSON.stringify(state)
        )
        .run();


        return json({
          ok: true,
          state: state
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
// JSON HELFER
// =========================================

function json(
  data,
  cors,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status: status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        ...cors
      }
    }
  );

}
