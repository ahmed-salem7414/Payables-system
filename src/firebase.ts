import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");
provider.addScope("https://www.googleapis.com/auth/userinfo.profile");

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let initialized = false;

export const initAuthListener = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    initialized = true;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Since Firebase persistent state doesn't store OAuth tokens inside the SDK object,
        // we ask the component to handle sign-in popup if they want Google Drive backup explicitly.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// Robust error handler following the firebase-integration skill guidelines
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "anonymous_client",
      email: null,
      emailVerified: false,
    },
    operationType,
    path
  };
  console.error("🔥 Client-side Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on initialization
export async function testConnection(): Promise<boolean> {
  // Direct client-side Firebase is disabled since we are migrating to PostgreSQL in the backend
  return false;
}

// Retrieve complete store from Firestore
export async function loadFromUserFirestore() {
  const store: any = {
    suppliers: [],
    invoices: [],
    payments: [],
    backups: [],
    creditNotes: []
  };

  try {
    const [suppliersSnap, invoicesSnap, paymentsSnap, backupsSnap, creditNotesSnap] = await Promise.all([
      getDocs(collection(db, "suppliers")),
      getDocs(collection(db, "invoices")),
      getDocs(collection(db, "payments")),
      getDocs(collection(db, "backups")),
      getDocs(collection(db, "creditNotes"))
    ]);

    store.suppliers = suppliersSnap.docs.map(doc => doc.data());
    store.invoices = invoicesSnap.docs.map(doc => doc.data());
    store.payments = paymentsSnap.docs.map(doc => doc.data());
    store.backups = backupsSnap.docs.map(doc => doc.data());
    store.creditNotes = creditNotesSnap.docs.map(doc => doc.data());

    try {
      const configDoc = await getDoc(doc(db, "config", "system"));
      if (configDoc.exists()) {
        const configData = configDoc.data();
        if (Array.isArray(configData.supplierCategories)) store.supplierCategories = configData.supplierCategories;
        if (Array.isArray(configData.warehouses)) store.warehouses = configData.warehouses;
        if (Array.isArray(configData.linkedBanks)) store.linkedBanks = configData.linkedBanks;
        if (typeof configData.safeBalance === "number") store.safeBalance = configData.safeBalance;
      }
    } catch (e) {
      console.warn("⚠️ system config read failed (rules block may restrict access)", e);
    }

    return store;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "bulk_load");
  }
}

// Save complete store to user's Firebase instance
export async function saveToUserFirestore(data: any) {
  try {
    const batch = writeBatch(db);

    const syncCollection = (colName: string, items: any[]) => {
      // Direct client batch writes
      items.forEach(item => {
        if (item && item.id) {
          const docRef = doc(db, colName, item.id);
          batch.set(docRef, item, { merge: true });
        }
      });
    };

    if (Array.isArray(data.suppliers)) syncCollection("suppliers", data.suppliers);
    if (Array.isArray(data.invoices)) syncCollection("invoices", data.invoices);
    if (Array.isArray(data.payments)) syncCollection("payments", data.payments);
    if (Array.isArray(data.backups)) syncCollection("backups", data.backups);
    if (Array.isArray(data.creditNotes)) syncCollection("creditNotes", data.creditNotes);

    // Sync system configurations
    const configDocRef = doc(db, "config", "system");
    batch.set(configDocRef, {
      supplierCategories: data.supplierCategories || [],
      warehouses: data.warehouses || [],
      linkedBanks: data.linkedBanks || [],
      safeBalance: typeof data.safeBalance === "number" ? data.safeBalance : 0
    }, { merge: true });

    await batch.commit();
    console.log("🔥 Direct client-side save-to-firestore completed successfully.");
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "bulk_save");
  }
}
