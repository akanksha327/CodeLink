import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.ts";
import { attachAuthenticatedUser, toSocketError } from "./auth.ts";
import { registerChatHandlers } from "./chat.ts";
import { registerEditorHandlers } from "./editor.ts";
import { registerWebRtcHandlers } from "./webrtc.ts";
import type { CodeLinkServer } from "./types.ts";

export function createSocketServer(httpServer: HttpServer) {
  const io: CodeLinkServer = new Server(httpServer, {
    cors: {
      origin: env.allowedCorsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      await attachAuthenticatedUser(socket);
      next();
    } catch (error) {
      next(toSocketError(error));
    }
  });

  registerChatHandlers(io);
  registerEditorHandlers(io);
  registerWebRtcHandlers(io);

  return io;
}
