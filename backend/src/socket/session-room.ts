import { ZodError } from "zod";
import { AppError } from "../lib/errors.ts";
import { ensureSocketSessionAccess } from "../services/session.service.ts";
import { getSessionRoomName } from "./rooms.ts";
import type {
  CodeLinkServer,
  CodeLinkSocket,
  PresenceEventPayload,
  TypingEventPayload,
} from "./types.ts";

const sessionPresence = new Map<string, Map<string, Set<string>>>();

function getPresenceMap(sessionId: string) {
  let presenceMap = sessionPresence.get(sessionId);

  if (!presenceMap) {
    presenceMap = new Map<string, Set<string>>();
    sessionPresence.set(sessionId, presenceMap);
  }

  return presenceMap;
}

function trackSocketPresence(sessionId: string, userId: string, socketId: string) {
  const presenceMap = getPresenceMap(sessionId);
  let socketIds = presenceMap.get(userId);
  const isFirstConnection = !socketIds || socketIds.size === 0;

  if (!socketIds) {
    socketIds = new Set<string>();
    presenceMap.set(userId, socketIds);
  }

  socketIds.add(socketId);

  return {
    isFirstConnection,
    onlineUserIds: [...presenceMap.keys()],
    onlineCount: presenceMap.size,
  };
}

function untrackSocketPresence(sessionId: string, userId: string, socketId: string) {
  const presenceMap = sessionPresence.get(sessionId);

  if (!presenceMap) {
    return {
      isOffline: false,
      onlineCount: 0,
    };
  }

  const socketIds = presenceMap.get(userId);

  if (!socketIds) {
    return {
      isOffline: false,
      onlineCount: presenceMap.size,
    };
  }

  socketIds.delete(socketId);

  if (socketIds.size > 0) {
    return {
      isOffline: false,
      onlineCount: presenceMap.size,
    };
  }

  presenceMap.delete(userId);

  if (presenceMap.size === 0) {
    sessionPresence.delete(sessionId);
    return {
      isOffline: true,
      onlineCount: 0,
    };
  }

  return {
    isOffline: true,
    onlineCount: presenceMap.size,
  };
}

function buildPresencePayload(
  sessionId: string,
  user: CodeLinkSocket["data"]["user"],
  online: boolean,
  onlineCount: number,
): PresenceEventPayload {
  return {
    sessionId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    online,
    onlineCount,
  };
}

export function buildTypingPayload(
  sessionId: string,
  user: CodeLinkSocket["data"]["user"],
): TypingEventPayload {
  return {
    sessionId,
    userId: user.id,
    userName: user.name,
  };
}

export async function ensureSocketJoinedSession(
  socket: CodeLinkSocket,
  sessionId: string,
  announceJoin: boolean,
) {
  await ensureSocketSessionAccess(sessionId, socket.data.user);

  const room = getSessionRoomName(sessionId);
  const alreadyJoined = socket.data.joinedSessionIds.has(sessionId);

  if (!alreadyJoined) {
    await socket.join(room);
    socket.data.joinedSessionIds.add(sessionId);
    console.log("User joined:", sessionId, socket.data.user.id);
  }

  const presence = trackSocketPresence(sessionId, socket.data.user.id, socket.id);

  if (announceJoin && presence.isFirstConnection) {
    socket.to(room).emit(
      "user-joined",
      buildPresencePayload(sessionId, socket.data.user, true, presence.onlineCount),
    );
  }

  return {
    room,
    onlineUserIds: presence.onlineUserIds,
  };
}

export function handleSocketDisconnect(io: CodeLinkServer, socket: CodeLinkSocket) {
  for (const sessionId of socket.data.joinedSessionIds) {
    const room = getSessionRoomName(sessionId);
    const presence = untrackSocketPresence(sessionId, socket.data.user.id, socket.id);

    if (presence.isOffline) {
      io.to(room).emit(
        "user-left",
        buildPresencePayload(sessionId, socket.data.user, false, presence.onlineCount),
      );
    }
  }

  socket.data.joinedSessionIds.clear();
}

export function getEventErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallbackMessage;
  }

  return fallbackMessage;
}
