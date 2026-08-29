export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    const url = new URL(request.url);

    // =====================================================
    // API: TEST
    // =====================================================

    if (
      url.pathname === "/api/test" &&
      request.method === "GET"
    ) {

      try {

        await env.DB.prepare(
          "SELECT 1"
        ).run();

        return json({
          ok: true,
          app: "Hausfussball",
          database: true,
          message: "Hausfussball API läuft"
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          app: "Hausfussball",
          database: false,
          error: error.message
        }, cors, 500);

      }
    }


    // =====================================================
    // API: SPIELSTAND LADEN
    // GET /api/state
    // =====================================================

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

        return json({
          ok: true,
          state: JSON.parse(row.data)
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 500);

      }
    }


    // =====================================================
    // API: KOMPLETTEN SPIELSTAND SPEICHERN
    // PUT /api/state
    // =====================================================

    if (
      url.pathname === "/api/state" &&
      request.method === "PUT"
    ) {

      try {

        const state = await request.json();

        // Grundstruktur absichern
        const cleanState = {
          homeTeam:
            typeof state.homeTeam === "string"
              ? state.homeTeam
              : "Heimteam",

          awayTeam:
            typeof state.awayTeam === "string"
              ? state.awayTeam
              : "Auswärtsteam",

          homeScore:
            Number.isFinite(state.homeScore)
              ? state.homeScore
              : 0,

          awayScore:
            Number.isFinite(state.awayScore)
              ? state.awayScore
              : 0,

          date:
            typeof state.date === "string"
              ? state.date
              : "",

          status:
            typeof state.status === "string"
              ? state.status
              : "not_started",

          startTime:
            state.startTime ?? null,

          elapsed:
            Number.isFinite(state.elapsed)
              ? state.elapsed
              : 0,

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


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(JSON.stringify(cleanState))
        .run();


        return json({
          ok: true,
          state: cleanState
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 400);

      }
    }


    // =====================================================
    // API: SPIELSTAND ZURÜCKSETZEN
    // DELETE /api/state
    // =====================================================

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


    // =====================================================
    // WEBSITE AUSLIEFERN
    // =====================================================

    if (env.ASSETS) {

      return env.ASSETS.fetch(request);

    }


    return json({
      ok: false,
      error: "Website assets nicht konfiguriert"
    }, cors, 500);

  }
};


// =====================================================
// JSON HELFER
// =====================================================

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
