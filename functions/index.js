const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const LITEPUSH_API = "https://api.litepush.dev";
const LITEPUSH_PROJECT = "prj_01M10ZZMB8FQ0P9199F3YTSQTK";

exports.sendMatchPush = onDocumentUpdated(
  {
    document: "matches/current",
    secrets: ["LITEPUSH_API_KEY"]
  },
  async (event) => {

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) return;

    const beforeEvents =
      Array.isArray(before?.events)
        ? before.events
        : [];

    const afterEvents =
      Array.isArray(after.events)
        ? after.events
        : [];

    // Nur reagieren, wenn ein neues Event hinzugekommen ist.
    if (afterEvents.length <= beforeEvents.length) {
      return;
    }

    // Deine App fügt neue Events vorne mit unshift() ein.
    const newEvent = afterEvents[0];

    if (!newEvent) return;

    const title =
      newEvent.pushTitle ||
      newEvent.title ||
      "⚽ Hausfußball";

    const body =
      newEvent.pushBody ||
      newEvent.info ||
      "Neues Ereignis im Live-Ticker!";

    const apiKey =
      process.env.LITEPUSH_API_KEY;

    if (!apiKey) {
      console.error(
        "LITEPUSH_API_KEY ist nicht gesetzt."
      );
      return;
    }

    const response =
      await fetch(
        `${LITEPUSH_API}/v1/send`,
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            project: LITEPUSH_PROJECT,

            title: title,

            body: body,

            data: {
              type: "match-event",
              matchId: "current"
            }
          })
        }
      );

    const text =
      await response.text();

    if (!response.ok) {

      console.error(
        "LitePush Fehler:",
        response.status,
        text
      );

      throw new Error(
        `LitePush HTTP ${response.status}`
      );
    }

    console.log(
      "Hausfußball Push gesendet:",
      title,
      text
    );
  }
);
