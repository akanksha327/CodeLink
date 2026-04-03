'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

let authStateReadyPromise: Promise<void> | null = null;
let analyticsPromise: Promise<unknown | null> | null = null;

function getRequiredEnvValue(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing Firebase config: ${key}`);
  }

  return value;
}

function getFirebaseConfig() {
  return {
    apiKey: getRequiredEnvValue(
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: getRequiredEnvValue(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: getRequiredEnvValue(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    appId: getRequiredEnvValue(
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

export function getFirebaseApp() {
  if (!getApps().length) {
    initializeApp(getFirebaseConfig());
  }

  return getApp();
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export async function getFirebaseAnalytics() {
  if (
    typeof window === 'undefined' ||
    !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  ) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = import('firebase/analytics')
      .then(async ({ getAnalytics, isSupported }) => {
        const supported = await isSupported();
        return supported ? getAnalytics(getFirebaseApp()) : null;
      })
      .catch((error) => {
        console.warn('Firebase analytics is unavailable:', error);
        return null;
      });
  }

  return analyticsPromise;
}

export async function waitForFirebaseAuthState(timeoutMs = 4_000) {
  const auth = getFirebaseAuth();

  if (auth.currentUser || typeof window === 'undefined') {
    return auth.currentUser;
  }

  if (!authStateReadyPromise) {
    authStateReadyPromise = new Promise((resolve) => {
      let finished = false;
      let unsubscribe: (() => void) | null = null;

      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timeoutId);
        unsubscribe?.();
        authStateReadyPromise = null;
        resolve();
      };

      const timeoutId = window.setTimeout(finish, timeoutMs);
      unsubscribe = onAuthStateChanged(
        auth,
        () => finish(),
        () => finish(),
      );
    });
  }

  await authStateReadyPromise;
  return auth.currentUser as User | null;
}
