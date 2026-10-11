/*
 * Öffentliche Firebase-Web-Konfiguration für Hausfußball.
 * Firebase-Projekt: hausfussball
 * Der FCM-Web-Push-VAPID-Key kommt aus Firebase Console → Projekteinstellungen
 * → Cloud Messaging → Web Push certificates.
 * Niemals Service-Account-JSON oder private Schlüssel hier ablegen.
 */
self.HAUSFUSSBALL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAzk1qGSesg45fBr4ZSmdpxSXCSGnc0KFY",
  authDomain: "hausfussball.firebaseapp.com",
  projectId: "hausfussball",
  storageBucket: "hausfussball.firebasestorage.app",
  messagingSenderId: "993563856895",
  appId: "1:993563856895:web:9de5ebd3f028d7670621ca"
};
self.HAUSFUSSBALL_FCM_VAPID_KEY = "BGcYglPLwCf0w1EzSiMBWSAoVftUGV0ZFnmmkPJ48Rryr_v8vinBmhDrnP-HDUw0HqfRaSIBUMhvnvQUpsqQ88M";

/* Supabase-Projektwerte später hier eintragen; keine Admin-/service_role-Keys verwenden. */
self.HAUSFUSSBALL_SUPABASE_URL = "";
self.HAUSFUSSBALL_SUPABASE_ANON_KEY = "";
