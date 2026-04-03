import { AppError } from "../lib/errors.ts";
import { createMessageForUser } from "../services/session.service.ts";
import { getSessionRoomName } from "./rooms.ts";
import type {
  CodeLinkServer,
  EventErrorAck,
  SendMessageAck,
} from "./types.ts";
import {
  buildTypingPayload,
  ensureSocketJoinedSession,
  getEventErrorMessage,
  handleSocketDisconnect,
} from "./session-room.ts";
import {
  parseSendMessageEventPayload,
  parseSessionEventPayload,
} from "./validation.ts";

const MESSAGE_RATE_LIMIT_WINDOW_MS = 5_000;
const MESSAGE_RATE_LIMIT_MAX = 8;
const messageRateLimitMap = new Map<string, number[]>();

function enforceMessageRateLimit(userId: string, sessionId: string) {
  const key = `${userId}:${sessionId}`;
  const now = Date.now();
  const recentTimestamps = (messageRateLimitMap.get(key) ?? []).filter(
    (timestamp) => now - timestamp < MESSAGE_RATE_LIMIT_WINDOW_MS,
  );

  if (recentTimestamps.length >= MESSAGE_RATE_LIMIT_MAX) {
    messageRateLimitMap.set(key, recentTimestamps);
    throw new AppError("Too many messages. Slow down a bit.", 429);
  }

  recentTimestamps.push(now);
  messageRateLimitMap.set(key, recentTimestamps);
}

export function registerChatHandlers(io: CodeLinkServer) {
  io.on("connection", (socket) => {
    socket.on("join-session", async (payload, acknowledge) => {
      try {
        const data = parseSessionEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, true);

        acknowledge?.({
          ok: true,
          sessionId: data.sessionId,
          room: joinedSession.room,
          onlineUserIds: joinedSession.onlineUserIds,
        });
      } catch (error) {
        acknowledge?.({
          error: getEventErrorMessage(error, "Could not join session"),
        } satisfies EventErrorAck);
      }
    });

    socket.on("send-message", async (payload, acknowledge) => {
      try {
        const data = parseSendMessageEventPayload(payload);
        await ensureSocketJoinedSession(socket, data.sessionId, true);
        enforceMessageRateLimit(socket.data.user.id, data.sessionId);

        const message = await createMessageForUser(data.sessionId, socket.data.user, {
          content: data.content,
        });

        io.to(getSessionRoomName(data.sessionId)).emit("receive-message", message);
        console.log("Message broadcasted", data.sessionId, message.id);
        acknowledge?.({
          ok: true,
          messageId: message.id,
          sessionId: data.sessionId,
        } satisfies SendMessageAck);
      } catch (error) {
        acknowledge?.({
          error: getEventErrorMessage(error, "Could not send message"),
        } satisfies EventErrorAck);
      }
    });

    socket.on("typing-start", async (payload) => {
      try {
        const data = parseSessionEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit(
          "typing-start",
          buildTypingPayload(data.sessionId, socket.data.user),
        );
      } catch {
        // Ignore typing errors to keep the UX lightweight.
      }
    });

    socket.on("typing-stop", async (payload) => {
      try {
        const data = parseSessionEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit(
          "typing-stop",
          buildTypingPayload(data.sessionId, socket.data.user),
        );
      } catch {
        // Ignore typing errors to keep the UX lightweight.
      }
    });

    socket.on("disconnect", () => {
      handleSocketDisconnect(io, socket);
    });
  });
}
