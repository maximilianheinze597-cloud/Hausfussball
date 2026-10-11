# Hausfußball – Cloud-Setup

## Architektur

- **GitHub Pages:** Web-App/PWA.
- **Cloudflare Worker + D1:** zentraler Live-Spielstand, Ereignisse und FCM-Geräte-Token.
- **Firebase Cloud Messaging (FCM):** Web-Push für Tore, Karten, Anpfiff, Halbzeit und Abpfiff.
- **Supabase:** vorbereitete News-Tabelle; die sichtbare News-Oberfläche ist in diesem Schritt noch nicht an Supabase angeschlossen.

## 1. Firebase Web-Konfiguration

Das vorhandene Firebase-Projekt `hausfussball` ist bereits in `firebase-config.js` eingetragen.

1. Öffne Firebase Console → Projekteinstellungen → Cloud Messaging.
2. Unter **Web Push certificates** einen VAPID-Schlüssel erstellen oder den bestehenden kopieren.
3. Trage den öffentlichen VAPID-Key in `HAUSFUSSBALL_FCM_VAPID_KEY` in `firebase-config.js` ein.
4. Stelle sicher, dass **Firebase Cloud Messaging API (V1)** im zugehörigen Google-Cloud-Projekt aktiviert ist.

Die Web-Konfiguration und der VAPID-Key sind öffentliche Client-Werte. Dort niemals private Schlüssel oder Service-Account-JSON speichern.

## 2. Cloudflare Worker – geheimer FCM-Zugang

1. Öffne Google Cloud Console und erstelle einen Service Account für das Firebase-Projekt. Erteile ihm eine Berechtigung, mit der er Firebase Cloud Messaging-Nachrichten senden darf.
2. Erstelle einen JSON-Schlüssel. **Nicht in GitHub hochladen und nicht in die Website einfügen.**
3. Cloudflare Dashboard → Workers & Pages → `hausfussball-live` → Settings → Variables and Secrets → Add → **Secret**.
4. Name: `FIREBASE_SERVICE_ACCOUNT_JSON`. Value: den vollständigen Inhalt der Service-Account-JSON-Datei.
5. Deploye die aktualisierte `worker.js`. Die bestehende D1-Bindung `DB` muss erhalten bleiben.

Alternativ lokal: `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON`, dann das JSON einfügen.

Der Worker legt die Tabelle `push_tokens` automatisch an. Wenn ein Gerät Push aktiviert, speichert er sein FCM-Token. Bei neuen Spielereignissen sendet der Worker Push-Nachrichten an die registrierten Geräte.

## 3. Supabase

1. Erstelle/öffne dein Supabase-Projekt.
2. Führe `supabase/schema.sql` im Supabase SQL Editor aus.
3. Trage Projekt-URL und den **anon/public key** in `firebase-config.js` unter `HAUSFUSSBALL_SUPABASE_URL` und `HAUSFUSSBALL_SUPABASE_ANON_KEY` ein.

**Wichtig:** Supabase-News sind mit Tabelle und Row-Level-Security vorbereitet, aber noch nicht in die sichtbare News-Oberfläche eingebunden. Der Live-Spielstand läuft weiterhin über D1, damit nicht zwei konkurrierende Spielstände entstehen. Niemals einen Supabase `service_role`-Key in eine öffentliche Datei eintragen.

## 4. Test

- App: `https://maximilianheinze597-cloud.github.io/Hausfussball/`
- Auf iPhone: Hausfußball zuerst **Zum Home-Bildschirm** hinzufügen, dann die installierte PWA öffnen und Push aktivieren.
- Status: `https://hausfussball-live.maximilianheinze597.workers.dev/api/push-status`

Ein Push wird erst wirklich zugestellt, wenn VAPID-Key, Worker-Secret und FCM API korrekt eingerichtet sind. Diese Werte lassen sich nicht sicher automatisch aus GitHub abrufen.
