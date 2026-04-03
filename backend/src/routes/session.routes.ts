import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.ts";
import { requireAuth } from "../middleware/auth.ts";
import { getSessionRoomName } from "../socket/rooms.ts";
import type { CodeLinkServer } from "../socket/types.ts";
import {
  clearMessagesForUser,
  createMessageForUser,
  createSessionForUser,
  endSessionForUser,
  getSessionForUser,
  joinSession,
  joinSessionByCode,
  listMessagesForUser,
  listSessionsForUser,
  updateSessionForUser,
} from "../services/session.service.ts";

export const sessionRouter = Router();

sessionRouter.use(requireAuth);

sessionRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const sessions = await listSessionsForUser(request.auth!.user);
    response.json({ sessions });
  }),
);

sessionRouter.post(
  "/join-by-code",
  asyncHandler(async (request, response) => {
    const session = await joinSessionByCode(request.auth!.user, request.body);
    response.json({ session });
  }),
);

sessionRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const session = await createSessionForUser(request.auth!.user, request.body);
    response.status(201).json({ session });
  }),
);

sessionRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const data = await getSessionForUser(request.params.id, request.auth!.user);
    response.json(data);
  }),
);

sessionRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const session = await updateSessionForUser(
      request.params.id,
      request.auth!.user,
      request.body,
    );

    response.json({ session });
  }),
);

sessionRouter.post(
  "/:id/join",
  asyncHandler(async (request, response) => {
    const session = await joinSession(
      request.auth!.user,
      request.params.id,
      request.body,
    );
    response.json({ session });
  }),
);

sessionRouter.post(
  "/:id/end",
  asyncHandler(async (request, response) => {
    const session = await endSessionForUser(request.params.id, request.auth!.user);
    response.json({ session });
  }),
);

sessionRouter.get(
  "/:id/messages",
  asyncHandler(async (request, response) => {
    const messages = await listMessagesForUser(
      request.params.id,
      request.auth!.user,
    );
    response.json({ messages });
  }),
);

sessionRouter.post(
  "/:id/messages",
  asyncHandler(async (request, response) => {
    const message = await createMessageForUser(
      request.params.id,
      request.auth!.user,
      request.body,
    );

    const io = request.app.get("io");
    if (io) {
      io.to(getSessionRoomName(request.params.id)).emit("receive-message", message);
    }

    response.status(201).json({ message });
  }),
);

sessionRouter.delete(
  "/:id/messages",
  asyncHandler(async (request, response) => {
    const result = await clearMessagesForUser(request.params.id, request.auth!.user);

    const io = request.app.get("io") as CodeLinkServer | undefined;
    if (io) {
      io.to(getSessionRoomName(request.params.id)).emit("messages-cleared", result);
    }

    response.json(result);
  }),
);
