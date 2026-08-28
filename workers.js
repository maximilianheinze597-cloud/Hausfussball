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
    // TEST
    // =========================================

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        ok: true,
        app: "Hausfussball",
        message: "Hausfussball API läuft"
      }, cors);
    }


    // =========================================
    // SPIELSTAND ABRUFEN
    // GET /api/state
    // =========================================

    if (
      url.pathname === "/api/state" &&
      request.method === "GET"
    ) {

      const state = await env.DB.prepare(`
        SELECT data
        FROM match_state
        WHERE id = 1
      `).first();

      if (!state) {

        const initialState = {
          home: 0,
          away: 0,
          events: []
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
        state: JSON.parse(state.data)
      }, cors);
    }


    // =========================================
    // SPIELSTAND / EVENT SPEICHERN
    // POST /api/event
    // =========================================

    if (
      url.pathname === "/api/event" &&
      request.method === "POST"
    ) {

      try {

        const event = await request.json();

        const current = await env.DB.prepare(`
          SELECT data
          FROM match_state
          WHERE id = 1
        `).first();

        let state = current
          ? JSON.parse(current.data)
          : {
              home: 0,
              away: 0,
              events: []
            };


        // Spielstand aktualisieren

        if (typeof event.home === "number") {
          state.home = event.home;
        }

        if (typeof event.away === "number") {
          state.away = event.away;
        }


        // Ereignis hinzufügen

        if (event.event) {

          state.events.push({
            ...event.event,
            timestamp: Date.now()
          });

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

      const state = {
        home: 0,
        away: 0,
        events: []
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
        state: state
      }, cors);
    }


    return json({
      ok: false,
      error: "Route nicht gefunden"
    }, cors, 404);
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
        "Content-Type": "application/json; charset=UTF-8",
        ...cors
      }
    }
  );

}
