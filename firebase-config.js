/*
 * Öffentliche Firebase-Web-Konfiguration für Hausfußball.
 * Hier Firebase Console → Projekteinstellungen → Deine Apps → Web-App eintragen.
 * Diese Werte sind keine Admin-Geheimnisse. Niemals Service-Account-JSON hier ablegen.
 */
window.HAUSFUSSBALL_FIREBASE_CONFIG = {
  apiKey: "HIER_EINTRAGEN_FIREBASE_API_KEY",
  authDomain: "HIER_EINTRAGEN.firebaseapp.com",
  projectId: "HIER_EINTRAGEN_FIREBASE_PROJECT_ID",
  storageBucket: "HIER_EINTRAGEN.firebasestorage.app",
  messagingSenderId: "HIER_EINTRAGEN_MESSAGING_SENDER_ID",
  appId: "HIER_EINTRAGEN_FIREBASE_APP_ID"
};
window.HAUSFUSSBALL_FCM_VAPID_KEY = "HIER_EINTRAGEN_FCM_WEB_PUSH_CERTIFICATE_KEY";

/*
 * Supabase ist optional. Live-Spielstand und Push-Token bleiben im Cloudflare-Worker/D1.
 * Supabase-URL und anon/public key hier erst nach Erstellung des Projekts eintragen.
 */
window.HAUSFUSSBALL_SUPABASE_URL = "";
window.HAUSFUSSBALL_SUPABASE_ANON_KEY = "";
