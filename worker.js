export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: cors
      });
    }

    const url = new URL(request.url);

    // =========================================
    // API TEST
    // =========================================

    if (
      url.pathname === "/api" &&
      request.method === "GET"
    ) {
      return json({
        ok: true,
        app: "Hausfussball",
        message: "Hausfussball API läuft"
      }, cors);
    }


    // =========================================
    // KOMPLETTEN SPIELSTAND LADEN
    // GET /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "GET"
    ) {

      const result = await env.DB.prepare(`
        SELECT data
        FROM match_state
        WHERE id = 1
      `).first();

      if (!result) {

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
        state: JSON.parse(result.data)
      }, cors);
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

        const state = await request.json();

        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(JSON.stringify(state))
        .run();

        return json({
          ok: true,
          state
        }, cors);

      } catch (error) {

        return json({
          ok: false,
          error: error.message
        }, cors, 400);

      }
    }


    // =========================================
    // EVENT HINZUFÜGEN / SPIELSTAND AKTUALISIEREN
    // POST /api/event
    // =========================================

    if (
      url.pathname === "/api/event" &&
      request.method === "POST"
    ) {

      try {

        const event = await request.json();

        const result = await env.DB.prepare(`
          SELECT data
          FROM match_state
          WHERE id = 1
        `).first();

        let state;

        if (result) {

          state = JSON.parse(result.data);

        } else {

          state = {
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

        }


        // Falls kompletter Spielstand übertragen wird
        if (event.state) {

          state = event.state;

        }

        // Einzelnes Ereignis hinzufügen
        else {

          if (!Array.isArray(state.events)) {
            state.events = [];
          }

          if (event.event) {

            state.events.push({
              ...event.event,
              timestamp: Date.now()
            });

          }

          if (typeof event.homeScore === "number") {
            state.homeScore = event.homeScore;
          }

          if (typeof event.awayScore === "number") {
            state.awayScore = event.awayScore;
          }

          if (typeof event.status === "string") {
            state.status = event.status;
          }

          if (event.startTime !== undefined) {
            state.startTime = event.startTime;
          }

          if (typeof event.elapsed === "number") {
            state.elapsed = event.elapsed;
          }

        }


        await env.DB.prepare(`
          INSERT INTO match_state (id, data)
          VALUES (1, ?)
          ON CONFLICT(id)
          DO UPDATE SET data = excluded.data
        `)
        .bind(JSON.stringify(state))
        .run();


        return json({
          ok: true,
          state
        }, cors);

      } catch (error) {

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

      const state = {

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
      .bind(JSON.stringify(state))
      .run();


      return json({
        ok: true,
        state
      }, cors);
    }


    // =========================================
    // WEBSITE AUSLIEFERN
    // =========================================

    return env.ASSETS.fetch(request);
  }
};


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
