import { z } from "zod";
import { SessionStatus } from "@prisma/client";
import { db } from "../lib/db.ts";
import { AppError } from "../lib/errors.ts";
import {
  serializeMessage,
  serializeSession,
  type ApiMessage,
  type ApiSession,
  type ApiUser,
} from "../lib/serializers.ts";
import { createInviteCode } from "../lib/security.ts";

const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Session title is required").max(200),
  mentorId: z.string().optional(),
  studentId: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  status: z.enum(["active", "scheduled", "ended"]).optional().default("active"),
  language: z
    .enum(["javascript", "typescript", "python", "java", "cpp"])
    .optional()
    .default("javascript"),
});

const joinSessionSchema = z.object({
  inviteCode: z.string().trim().min(1).optional(),
});

const joinByCodeSchema = z.object({
  inviteCode: z.string().trim().min(1, "Invite code is required").max(32),
});

const updateSessionSchema = z
  .object({
    title: z.string().trim().min(1, "Session title is required").max(200).optional(),
    createdAt: z.coerce.date().optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.createdAt !== undefined,
    "Provide at least one field to update",
  );

const messageSchema = z.object({
  content: z.string().trim().min(1, "Message content is required").max(5000),
});

async function activateSessionIfDue<T extends { id: string; status: SessionStatus; createdAt: Date }>(
  session: T,
) {
  if (
    session.status !== SessionStatus.SCHEDULED ||
    session.createdAt.getTime() > Date.now()
  ) {
    return session;
  }

  return db.session.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.ACTIVE,
    },
    include: {
      mentor: true,
      student: true,
    },
  });
}

async function activateDueScheduledSessionsForUser(userId: string) {
  await db.session.updateMany({
    where: {
      status: SessionStatus.SCHEDULED,
      createdAt: {
        lte: new Date(),
      },
      OR: [{ mentorId: userId }, { studentId: userId }],
    },
    data: {
      status: SessionStatus.ACTIVE,
    },
  });
}

async function ensureParticipantAccess(sessionId: string, userId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      mentor: true,
      student: true,
    },
  });

  if (!session) {
    throw new AppError("Session not found", 404);
  }

  const isParticipant =
    session.mentorId === userId || session.studentId === userId;

  if (!isParticipant) {
    throw new AppError("You do not have access to this session", 403);
  }

  return activateSessionIfDue(session);
}

async function findSessionById(sessionId: string) {
  return db.session.findUnique({
    where: { id: sessionId },
    include: {
      mentor: true,
      student: true,
    },
  });
}

async function findSessionByInviteCode(inviteCode: string) {
  return db.session.findUnique({
    where: { inviteCode },
    include: {
      mentor: true,
      student: true,
    },
  });
}

function isParticipant(session: { mentorId: string; studentId: string | null }, userId: string) {
  return session.mentorId === userId || session.studentId === userId;
}

function canPreviewSessionBeforeJoin(
  session: { studentId: string | null },
  user: ApiUser,
) {
  return user.role === "student" && !session.studentId;
}

async function ensureSessionAccessForUser(
  sessionId: string,
  user: ApiUser,
  options?: { allowPendingStudentPreview?: boolean },
) {
  const sessionRecord = await findSessionById(sessionId);

  if (!sessionRecord) {
    throw new AppError("Session not found", 404);
  }

  const session = await activateSessionIfDue(sessionRecord);
  const participant = isParticipant(session, user.id);
  const previewAllowed =
    options?.allowPendingStudentPreview && canPreviewSessionBeforeJoin(session, user);

  if (!participant && !previewAllowed) {
    throw new AppError("You do not have access to this session", 403);
  }

  return {
    session,
    participant,
  };
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = createInviteCode();
    const existingSession = await db.session.findUnique({
      where: { inviteCode },
      select: { id: true },
    });

    if (!existingSession) {
      return inviteCode;
    }
  }

  throw new AppError("Could not generate a unique invite code", 500);
}

export async function listSessionsForUser(user: ApiUser) {
  await activateDueScheduledSessionsForUser(user.id);

  const sessions = await db.session.findMany({
    where: {
      OR: [{ mentorId: user.id }, { studentId: user.id }],
    },
    include: {
      mentor: true,
      student: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return sessions.map(serializeSession);
}

export async function createSessionForUser(user: ApiUser, input: unknown) {
  if (user.role !== "mentor") {
    throw new AppError("Only mentors can create sessions", 403);
  }

  const data = createSessionSchema.parse(input);
  const providedStudentId =
    data.studentId && data.studentId !== "pending" ? data.studentId : null;

  if (providedStudentId) {
    const assignedStudent = await db.user.findUnique({
      where: { id: providedStudentId },
    });

    if (!assignedStudent || assignedStudent.role !== "STUDENT") {
      throw new AppError("Assigned student was not found", 400);
    }
  }

  const session = await db.session.create({
    data: {
      title: data.title,
      mentorId: user.id,
      studentId: providedStudentId,
      inviteCode: await generateUniqueInviteCode(),
      code: data.code ?? null,
      language: data.language,
      status: data.status.toUpperCase() as SessionStatus,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    },
    include: {
      mentor: true,
      student: true,
    },
  });

  return serializeSession(session);
}

export async function getSessionForUser(sessionId: string, user: ApiUser) {
  const { session, participant } = await ensureSessionAccessForUser(sessionId, user, {
    allowPendingStudentPreview: true,
  });
  const messages = participant
    ? await db.message.findMany({
        where: { sessionId: session.id },
        include: { sender: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return {
    session: serializeSession(session),
    messages: messages.map(serializeMessage),
  };
}

export async function updateSessionForUser(
  sessionId: string,
  user: ApiUser,
  input: unknown,
) {
  if (user.role !== "mentor") {
    throw new AppError("Only mentors can edit scheduled sessions", 403);
  }

  const data = updateSessionSchema.parse(input);
  const sessionRecord = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      mentor: true,
      student: true,
    },
  });

  if (!sessionRecord) {
    throw new AppError("Session not found", 404);
  }

  const session = await activateSessionIfDue(sessionRecord);

  if (session.mentorId !== user.id) {
    throw new AppError("Only the mentor can edit this session", 403);
  }

  if (session.status !== SessionStatus.SCHEDULED) {
    throw new AppError("Only scheduled sessions can be edited", 400);
  }

  const updatedSession = await db.session.update({
    where: { id: sessionId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
    },
    include: {
      mentor: true,
      student: true,
    },
  });

  return serializeSession(updatedSession);
}

async function joinSessionRecordForUser(
  user: ApiUser,
  sessionRecord: Awaited<ReturnType<typeof findSessionById>> extends infer T
    ? NonNullable<T>
    : never,
) {
  const session = await activateSessionIfDue(sessionRecord);

  if (session.status === SessionStatus.ENDED) {
    throw new AppError("This session has already ended", 400);
  }

  if (user.role === "mentor") {
    if (session.mentorId !== user.id) {
      throw new AppError("Only the session mentor can join as mentor", 403);
    }

    const updatedSession =
      session.status === SessionStatus.ACTIVE
        ? session
        : await db.session.update({
            where: { id: session.id },
            data: { status: SessionStatus.ACTIVE },
            include: {
              mentor: true,
              student: true,
            },
          });

    return serializeSession(updatedSession);
  }

  if (session.studentId && session.studentId !== user.id) {
    throw new AppError("This session is already assigned to another student", 403);
  }

  const updatedSession = await db.session.update({
    where: { id: session.id },
    data: {
      studentId: user.id,
      status: SessionStatus.ACTIVE,
    },
    include: {
      mentor: true,
      student: true,
    },
  });

  return serializeSession(updatedSession);
}

export async function joinSessionByCode(user: ApiUser, input: unknown) {
  const data = joinByCodeSchema.parse(input);
  const sessionRecord = await findSessionByInviteCode(data.inviteCode);

  if (!sessionRecord) {
    throw new AppError("Invalid code", 404);
  }

  return joinSessionRecordForUser(user, sessionRecord);
}

export async function joinSession(user: ApiUser, sessionId: string, input: unknown) {
  joinSessionSchema.parse(input ?? {});

  const sessionRecord = await findSessionById(sessionId.trim());

  if (!sessionRecord) {
    throw new AppError("Session not found", 404);
  }

  return joinSessionRecordForUser(user, sessionRecord);
}

export async function endSessionForUser(sessionId: string, user: ApiUser) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      mentor: true,
      student: true,
    },
  });

  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.mentorId !== user.id || user.role !== "mentor") {
    throw new AppError("Only the mentor can end this session", 403);
  }

  const updatedSession = await db.session.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.ENDED,
      endedAt: new Date(),
    },
    include: {
      mentor: true,
      student: true,
    },
  });

  return serializeSession(updatedSession);
}

export async function listMessagesForUser(sessionId: string, user: ApiUser) {
  await ensureParticipantAccess(sessionId, user.id);

  const messages = await db.message.findMany({
    where: { sessionId },
    include: {
      sender: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return messages.map(serializeMessage);
}

export async function createMessageForUser(
  sessionId: string,
  user: ApiUser,
  input: unknown,
): Promise<ApiMessage> {
  await ensureParticipantAccess(sessionId, user.id);
  const data = messageSchema.parse(input);

  const message = await db.message.create({
    data: {
      sessionId,
      senderId: user.id,
      content: data.content,
    },
    include: {
      sender: true,
    },
  });

  return serializeMessage(message);
}

export async function clearMessagesForUser(sessionId: string, user: ApiUser) {
  await ensureParticipantAccess(sessionId, user.id);

  await db.message.deleteMany({
    where: { sessionId },
  });

  return {
    sessionId,
    clearedByUserId: user.id,
  };
}

export async function ensureSocketSessionAccess(sessionId: string, user: ApiUser): Promise<ApiSession> {
  const session = await ensureParticipantAccess(sessionId, user.id);
  return serializeSession(session);
}
