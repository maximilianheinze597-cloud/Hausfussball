# Hausfußball

Mobile-first Fußball-Live-Ticker als PWA.

## Cloud-Architektur

- GitHub Pages: Frontend und PWA
- Cloudflare Worker + D1: gemeinsamer Spielstand, Ereignisse und Push-Token-Registrierung
- Firebase Cloud Messaging: Push-Benachrichtigungen
- Supabase: vorbereitete News-Datenbank mit Row-Level Security

## Einrichtung

Die vollständige Anleitung für Firebase, Cloudflare Secrets und Supabase steht in [SETUP_CLOUD.md](./SETUP_CLOUD.md).

**Wichtig:** Push-Zustellung wird erst aktiv, nachdem der FCM-VAPID-Key in `firebase-config.js` und das Worker-Secret `FIREBASE_SERVICE_ACCOUNT_JSON` in Cloudflare eingerichtet wurden. Supabase-News sind zunächst als sichere Datenbank-Grundlage vorbereitet; die sichtbare News-Oberfläche ist noch nicht angeschlossen.
