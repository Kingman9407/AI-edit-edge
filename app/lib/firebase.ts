import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const isDev = process.env.NODE_ENV === "development";
const dbg = isDev ? console.log.bind(console) : () => {};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// ─── DEBUG: Firebase config check (dev-only) ──────────────────────────────────
if (isDev) {
  console.group("[Firebase] Initializing with config");
  console.log("  apiKey:", firebaseConfig.apiKey ? `${firebaseConfig.apiKey.slice(0, 6)}…` : "❌ MISSING");
  console.log("  authDomain:", firebaseConfig.authDomain ?? "❌ MISSING");
  console.log("  projectId:", firebaseConfig.projectId ?? "❌ MISSING");
  console.log("  storageBucket:", firebaseConfig.storageBucket ?? "❌ MISSING");
  console.log("  messagingSenderId:", firebaseConfig.messagingSenderId ?? "❌ MISSING");
  console.log("  appId:", firebaseConfig.appId ?? "❌ MISSING");
  console.log("  measurementId:", firebaseConfig.measurementId ?? "(optional – not set)");
  console.groupEnd();
}

let app;
try {
  app = initializeApp(firebaseConfig);
  dbg("[Firebase] ✅ initializeApp() succeeded");
} catch (err) {
  // Always log init failures — this is a fatal misconfiguration
  console.error("[Firebase] ❌ initializeApp() FAILED:", err);
  throw err;
}

export const auth = getAuth(app);
dbg("[Firebase] auth instance created:", auth.app.name);

export const googleProvider = new GoogleAuthProvider();
dbg("[Firebase] googleProvider created, providerId:", googleProvider.providerId);
