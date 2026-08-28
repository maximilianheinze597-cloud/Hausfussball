export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: cors
      });
    }

    const url = new URL(request.url);

    // Spielstand abrufen
    if (
      request.method === "GET" &&
      url.pathname === "/api/state"
    ) {
      return new Response(
        JSON.stringify({
          ok: true,
          app: "Hausfussball",
          score: {
            home: 0,
            away: 0
          },
          events: []
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...cors
          }
        }
      );
    }

    // Neues Ereignis empfangen
    if (
      request.method === "POST" &&
      url.pathname === "/api/event"
    ) {
      try {
        const event = await request.json();

        return new Response(
          JSON.stringify({
            ok: true,
            app: "Hausfussball",
            received: event
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...cors
            }
          }
        );

      } catch {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Ungültige Daten"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...cors
            }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        app: "Hausfussball",
        message: "Hausfussball API läuft"
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...cors
        }
      }
    );
  }
};
