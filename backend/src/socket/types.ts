import type { Server, Socket } from "socket.io";
import type { ApiMessage, ApiUser } from "../lib/serializers.ts";

export interface PresenceEventPayload {
  sessionId: string;
  userId: string;
  userName: string;
  userRole: ApiUser["role"];
  online: boolean;
  onlineCount: number;
}

export interface TypingEventPayload {
  sessionId: string;
  userId: string;
  userName: string;
}

export interface MessagesClearedPayload {
  sessionId: string;
  clearedByUserId: string;
}

export interface CodeUpdatePayload {
  code: string;
  language: string;
}

export interface WebRtcReadyPayload {
  sessionId: string;
  readyUserId: string;
  readyUserRole: ApiUser["role"];
}

export interface WebRtcSessionDescriptionPayload {
  type?: string;
  sdp?: string;
  [key: string]: unknown;
}

export interface WebRtcIceCandidatePayload {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
  [key: string]: unknown;
}

export interface JoinSessionAck {
  ok: true;
  sessionId: string;
  room: string;
  onlineUserIds: string[];
}

export interface EventErrorAck {
  error: string;
}

export interface SendMessageAck {
  ok: true;
  messageId: string;
  sessionId: string;
}

export interface ClientToServerEvents {
  "join-session": (
    payload: { sessionId?: string },
    acknowledge?: (response: JoinSessionAck | EventErrorAck) => void,
  ) => void;
  "send-message": (
    payload: { sessionId?: string; content?: string },
    acknowledge?: (response: SendMessageAck | EventErrorAck) => void,
  ) => void;
  "code-change": (
    payload: { sessionId?: string; code?: string; language?: string },
  ) => void;
  "webrtc-ready": (payload: { sessionId?: string }) => void;
  "webrtc-offer": (
    payload: {
      sessionId?: string;
      offer?: WebRtcSessionDescriptionPayload;
    },
  ) => void;
  "webrtc-answer": (
    payload: {
      sessionId?: string;
      answer?: WebRtcSessionDescriptionPayload;
    },
  ) => void;
  "webrtc-ice-candidate": (
    payload: {
      sessionId?: string;
      candidate?: WebRtcIceCandidatePayload;
    },
  ) => void;
  "typing-start": (payload: { sessionId?: string }) => void;
  "typing-stop": (payload: { sessionId?: string }) => void;
}

export interface ServerToClientEvents {
  "receive-message": (message: ApiMessage) => void;
  "code-update": (payload: CodeUpdatePayload) => void;
  "webrtc-ready": (payload: WebRtcReadyPayload) => void;
  "webrtc-offer": (
    payload: {
      sessionId: string;
      offer: WebRtcSessionDescriptionPayload;
    },
  ) => void;
  "webrtc-answer": (
    payload: {
      sessionId: string;
      answer: WebRtcSessionDescriptionPayload;
    },
  ) => void;
  "webrtc-ice-candidate": (
    payload: {
      sessionId: string;
      candidate: WebRtcIceCandidatePayload;
    },
  ) => void;
  "user-joined": (payload: PresenceEventPayload) => void;
  "user-left": (payload: PresenceEventPayload) => void;
  "typing-start": (payload: TypingEventPayload) => void;
  "typing-stop": (payload: TypingEventPayload) => void;
  "messages-cleared": (payload: MessagesClearedPayload) => void;
}

export interface SocketData {
  user: ApiUser;
  joinedSessionIds: Set<string>;
  readySessionIds: Set<string>;
}

export type CodeLinkSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type CodeLinkServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
