import type { CodeLinkServer } from "./types.ts";
import { ensureSocketJoinedSession } from "./session-room.ts";
import { parseCodeChangeEventPayload } from "./validation.ts";

export function registerEditorHandlers(io: CodeLinkServer) {
  io.on("connection", (socket) => {
    socket.on("code-change", async (payload) => {
      try {
        const data = parseCodeChangeEventPayload(payload);
        const joinedSession = await ensureSocketJoinedSession(socket, data.sessionId, false);

        socket.to(joinedSession.room).emit("code-update", {
          code: data.code,
          language: data.language,
        });
        console.log("Code update sent", data.sessionId, data.language);
      } catch {
        // Ignore code sync errors to keep the editor responsive.
      }
    });
  });
}
