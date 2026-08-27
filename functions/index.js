const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

/*
 * Hausfußball Push-System
 *
 * Sobald ein neues Ereignis unter
 * matches/current/events angelegt wird,
 * werden alle registrierten Geräte benachrichtigt.
 */

exports.sendMatchPush = onDocumentCreated(
  "matches/current/events/{eventId}",
  async (event) => {

    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const data = snapshot.data();

    const title =
      data.pushTitle ||
      "⚽ Hausfußball";

    const body =
      data.pushBody ||
      data.title ||
      "Es gibt ein neues Ereignis im Live-Ticker!";

    /*
     * Tokens werden aus der Sammlung
     *
     * pushTokens
     *
     * gelesen.
     */

    const admin = require("firebase-admin");

    const tokensSnapshot =
      await admin
        .firestore()
        .collection("pushTokens")
        .get();

    if (tokensSnapshot.empty) {
      console.log(
        "Keine Push-Tokens vorhanden."
      );

      return;
    }

    const tokens = [];

    tokensSnapshot.forEach((doc) => {

      const token =
        doc.data().token;

      if (token) {
        tokens.push(token);
      }

    });

    if (!tokens.length) {
      return;
    }

    /*
     * Push-Nachricht
     */

    const message = {

      notification: {
        title: title,
        body: body
      },

      data: {
        type:
          data.type ||
          "match-event",

        matchId:
          "current"
      }

    };


    /*
     * An alle Geräte senden.
     */

    const response =
      await getMessaging()
        .sendEachForMulticast({
          tokens: tokens,
          ...message
        });


    console.log(
      `Push gesendet: ${response.successCount} erfolgreich`
    );


    /*
     * Ungültige Tokens entfernen.
     */

    const firestore =
      admin.firestore();

    const deletes = [];

    response.responses.forEach(
      (result, index) => {

        if (!result.success) {

          const code =
            result.error?.code || "";

          if (
            code.includes(
              "registration-token-not-registered"
            ) ||
            code.includes(
              "invalid-registration-token"
            )
          ) {

            deletes.push(
              firestore
                .collection("pushTokens")
                .doc(tokens[index])
                .delete()
            );

          }

        }

      }
    );


    await Promise.all(deletes);

  }
);
