'use client';

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  reload,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type AuthError,
} from 'firebase/auth';
import type { User, UserRole } from '@/store/mentorship-store';
import { getFirebaseAuth, waitForFirebaseAuthState } from './firebase';

interface FirebaseSessionApiResponse {
  user?: User;
  requiresEmailVerification?: boolean;
  error?: string;
}

interface SignupOptions {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

interface PendingSignupProfile {
  email: string;
  name: string;
  role: UserRole;
}

type FirebaseAuthOutcome =
  | { type: 'authenticated'; user: User }
  | { type: 'email_verification_required' };

const pendingSignupProfileStorageKey = 'codelink_pending_signup_profile';

function savePendingSignupProfile(profile: PendingSignupProfile) {
  window.localStorage.setItem(
    pendingSignupProfileStorageKey,
    JSON.stringify({
      ...profile,
      email: profile.email.toLowerCase(),
    }),
  );
}

function getPendingSignupProfile(email?: string) {
  const rawValue = window.localStorage.getItem(pendingSignupProfileStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedProfile = JSON.parse(rawValue) as PendingSignupProfile;

    if (!email || parsedProfile.email === email.toLowerCase()) {
      return parsedProfile;
    }
  } catch {
    window.localStorage.removeItem(pendingSignupProfileStorageKey);
  }

  return null;
}

function clearPendingSignupProfile(email?: string) {
  const pendingProfile = getPendingSignupProfile(email);

  if (pendingProfile) {
    window.localStorage.removeItem(pendingSignupProfileStorageKey);
  }
}

async function exchangeFirebaseTokenForSession(input: {
  idToken: string;
  name?: string;
  role?: UserRole;
}): Promise<FirebaseAuthOutcome> {
  const response = await fetch('/api/auth/firebase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => null)) as FirebaseSessionApiResponse | null;

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to create backend session');
  }

  if (data?.requiresEmailVerification) {
    return { type: 'email_verification_required' };
  }

  if (!data?.user) {
    throw new Error('Failed to create backend session');
  }

  return {
    type: 'authenticated',
    user: data.user,
  };
}

async function ensureFirebasePersistence() {
  await setPersistence(getFirebaseAuth(), browserLocalPersistence);
}

export async function loginWithFirebase(email: string, password: string) {
  await ensureFirebasePersistence();

  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await reload(credential.user);

  if (!credential.user.emailVerified) {
    await signOut(auth).catch(() => undefined);
    return { type: 'email_verification_required' } satisfies FirebaseAuthOutcome;
  }

  const pendingSignupProfile = getPendingSignupProfile(credential.user.email ?? email);
  const idToken = await credential.user.getIdToken(true);
  const result = await exchangeFirebaseTokenForSession({
    idToken,
    ...(pendingSignupProfile
      ? {
          name: pendingSignupProfile.name,
          role: pendingSignupProfile.role,
        }
      : {}),
  });

  if (result.type === 'authenticated') {
    clearPendingSignupProfile(credential.user.email ?? email);
  }

  if (result.type === 'email_verification_required') {
    await signOut(auth).catch(() => undefined);
  }

  return result;
}

export async function signupWithFirebase({
  email,
  password,
  name,
  role,
}: SignupOptions) {
  await ensureFirebasePersistence();

  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  savePendingSignupProfile({
    email,
    name,
    role,
  });

  try {
    await updateProfile(credential.user, {
      displayName: name,
    });

    await sendEmailVerification(credential.user);
    await fetch('/api/auth/logout', {
      method: 'POST',
    }).catch(() => undefined);

    await signOut(auth).catch(() => undefined);

    return { type: 'email_verification_required' } satisfies FirebaseAuthOutcome;
  } catch (error) {
    clearPendingSignupProfile(email);
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function restoreBackendSessionFromFirebase() {
  const firebaseUser = await waitForFirebaseAuthState();

  if (!firebaseUser) {
    return null;
  }

  try {
    await reload(firebaseUser);

    if (!firebaseUser.emailVerified) {
      return null;
    }

    const pendingSignupProfile = getPendingSignupProfile(firebaseUser.email ?? undefined);
    const idToken = await firebaseUser.getIdToken(true);
    const result = await exchangeFirebaseTokenForSession({
      idToken,
      ...(pendingSignupProfile
        ? {
            name: pendingSignupProfile.name,
            role: pendingSignupProfile.role,
          }
        : {}),
    });

    if (result.type !== 'authenticated') {
      return null;
    }

    clearPendingSignupProfile(firebaseUser.email ?? undefined);
    return result.user;
  } catch (error) {
    console.error('Failed to restore backend session from Firebase:', error);
    return null;
  }
}

export async function logoutEverywhere() {
  const auth = getFirebaseAuth();
  const operations: Promise<unknown>[] = [
    fetch('/api/auth/logout', {
      method: 'POST',
    }).catch(() => undefined),
  ];

  if (auth.currentUser) {
    operations.push(signOut(auth));
  }

  await Promise.allSettled(operations);
}

export function getFirebaseAuthErrorMessage(error: unknown) {
  const authError = error as AuthError | undefined;

  switch (authError?.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      if (error instanceof Error) {
        if (error.message === 'Please verify your email before signing in.') {
          return 'Please verify your email before signing in. Check your inbox and spam folder.';
        }

        return error.message;
      }

      return 'Authentication failed.';
  }
}
