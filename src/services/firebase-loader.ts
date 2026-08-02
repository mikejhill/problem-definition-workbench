import type { FirebaseServices } from "./firebase-services";

export const firebaseIsConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_APP_ID,
);

export async function loadFirebaseServices(): Promise<FirebaseServices> {
  if (!firebaseIsConfigured) throw new Error("Firebase is not configured for this deployment.");
  const module = await import("./firebase-services");
  return module.getFirebaseServices();
}
