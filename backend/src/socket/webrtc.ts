import type { CodeLinkSocket, CodeLinkServer } from "./types.ts";
import { ensureSocketJoinedSession, getEventErrorMessage } from "./session-room.ts";
import {
  parseSessionEventPayload,
  parseWebRtcAnswerEventPayload,
  parseWebRtcIceCandidateEventPayload,
  parseWebRtcOfferEventPayload,
} from "./validation.ts";

const readyParticipants = new Map<string, Map<string, Set<string>>>();

function getReadyMap(sessionId: string) {
  let readyMap = readyParticipants.get(sessionId);

  if (!readyMap) {
    readyMap = new Map<string, Set<string>>();
    readyParticipants.set(sessionId, readyMap);
  }

  return readyMap;
}

function markSocketReady(sessionId: string, userId: string, socketId: string) {
  const readyMap = getReadyMap(sessionId);
  let socketIds = readyMap.get(userId);

  if (!socketIds) {
    socketIds = new Set<string>();
    readyMap.set(userId, socketIds);
  }

  socketIds.add(socketId);

  return {
    readyUserIds: [...readyMap.keys()],
  };
}

function clearSocketReady(sessionId: string, userId: string, socketId: string) {
  const readyMap = readyParticipants.get(sessionId);

  if (!readyMap) {
    return;
  }

  const socketIds = readyMap.get(userId);

  if (!socketIds) {
    return;
  }

  socketIds.delete(socketId);

  if (socketIds.size === 0) {
    readyMap.delete(userId);
  }

  if (readyMap.size === 0) {
    readyParticipants.delete(sessionId);
  }
}

function clearSocketReadySessions(socket: CodeLinkSocket) {
  for (const sessionId of socket.data.readySessionIds) {
    clearSocketReady(sessionId, socket.data.user.id, socket.id);
  }

  socket.data.readySessionIds.clear();
}

export function registerWebRtcHandlers(io: CodeLinkServer) {
  io.on("connection", (socket) => {
    socket.on("webrtc-ready", async (payload) => {
      try {
        const data = parseSessionEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);
        const readiness = markSocketReady(data.sessionId, socket.data.user.id, socket.id);

        socket.data.readySessionIds.add(data.sessionId);

        if (readiness.readyUserIds.length >= 2) {
          io.to(joinedSession.room).emit("webrtc-ready", {
            sessionId: data.sessionId,
            readyUserId: socket.data.user.id,
            readyUserRole: socket.data.user.role,
          });
        }
      } catch (error) {
        console.error(
          "WebRTC ready failed:",
          getEventErrorMessage(error, "Could not prepare video call"),
        );
      }
    });

    socket.on("webrtc-offer", async (payload) => {
      try {
        const data = parseWebRtcOfferEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit("webrtc-offer", {
          sessionId: data.sessionId,
          offer: data.offer,
        });
        console.log("WebRTC offer relayed", data.sessionId, socket.data.user.id);
      } catch (error) {
        console.error(
          "WebRTC offer failed:",
          getEventErrorMessage(error, "Could not relay offer"),
        );
      }
    });

    socket.on("webrtc-answer", async (payload) => {
      try {
        const data = parseWebRtcAnswerEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit("webrtc-answer", {
          sessionId: data.sessionId,
          answer: data.answer,
        });
        console.log("WebRTC answer relayed", data.sessionId, socket.data.user.id);
      } catch (error) {
        console.error(
          "WebRTC answer failed:",
          getEventErrorMessage(error, "Could not relay answer"),
        );
      }
    });

    socket.on("webrtc-ice-candidate", async (payload) => {
      try {
        const data = parseWebRtcIceCandidateEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit("webrtc-ice-candidate", {
          sessionId: data.sessionId,
          candidate: data.candidate,
        });
        console.log("ICE candidate relayed", data.sessionId, socket.data.user.id);
      } catch (error) {
        console.error(
          "WebRTC ICE candidate failed:",
          getEventErrorMessage(error, "Could not relay ICE candidate"),
        );
      }
    });

    socket.on("disconnect", () => {
      clearSocketReadySessions(socket);
    });
  });
}
