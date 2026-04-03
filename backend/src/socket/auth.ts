import { env } from "../config/env.ts";
import { db } from "../lib/db.ts";
import { AppError } from "../lib/errors.ts";
import { parseCookieHeader } from "../lib/security.ts";
import { serializeUser } from "../lib/serializers.ts";
import { verifyFirebaseIdToken } from "../lib/firebase-admin.ts";
import { getAuthSessionByToken } from "../services/auth.service.ts";
import type { CodeLinkSocket } from "./types.ts";

async function attachFirebaseAuthenticatedUser(socket: CodeLinkSocket) {
  const authPayload = socket.handshake.auth as {
    firebaseIdToken?: unknown;
  };
  const firebaseIdToken =
    typeof authPayload.firebaseIdToken === "string"
      ? authPayload.firebaseIdToken.trim()
      : "";

  if (!firebaseIdToken) {
    throw new AppError("Authentication required", 401);
  }

  const decodedToken = await verifyFirebaseIdToken(firebaseIdToken);
  const email = decodedToken.email?.trim().toLowerCase();

  if (!email) {
    throw new AppError("Firebase account is missing an email address", 400);
  }

  if (!decodedToken.email_verified) {
    throw new AppError("Please verify your email before using realtime features.", 403);
  }

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError("Please sign in again to finish account setup.", 401);
  }

  socket.data.user = serializeUser(user);
}

export async function attachAuthenticatedUser(socket: CodeLinkSocket) {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  const token = cookies[env.SESSION_COOKIE_NAME];
  const authSession = await getAuthSessionByToken(token);

  if (authSession) {
    socket.data.user = serializeUser(authSession.user);
  } else {
    await attachFirebaseAuthenticatedUser(socket);
  }

  socket.data.joinedSessionIds = new Set<string>();
  socket.data.readySessionIds = new Set<string>();
}

export function toSocketError(error: unknown) {
  if (error instanceof AppError) {
    return new Error(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Socket connection failed");
}
