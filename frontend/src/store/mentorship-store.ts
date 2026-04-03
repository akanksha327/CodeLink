import { create } from 'zustand';
import { DEFAULT_CODE, EMPTY_CODE, getDefaultCode } from '@/lib/default-code';

export type UserRole = 'mentor' | 'student';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  createdAt?: Date | string;
  defaultLanguage?: string | null;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  title: string;
  status: 'active' | 'scheduled' | 'ended';
  mentorId: string;
  mentorName: string;
  studentId?: string | null;
  studentName?: string | null;
  createdAt: Date;
  code?: string | null;
  language?: string | null;
  inviteCode?: string | null;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  compileOutput: string;
  status: string;
  statusCode: number;
  time: string;
  memory: string;
  simulated?: boolean;
}

const DEFAULT_CODE_VALUES = new Set(Object.values(DEFAULT_CODE));
const FALLBACK_LANGUAGE = 'javascript';
const GLOBAL_DRAFT_SCOPE = '__global__';

type CodeDraftMap = Record<string, Record<string, string>>;

function shouldSwapToStarterCode(code: string) {
  const trimmedCode = code.trim();

  return !trimmedCode || code === EMPTY_CODE || DEFAULT_CODE_VALUES.has(code);
}

function resolvePreferredLanguage(preferredLanguage?: string | null) {
  if (!preferredLanguage || !DEFAULT_CODE[preferredLanguage]) {
    return FALLBACK_LANGUAGE;
  }

  return preferredLanguage;
}

function getDraftScope(sessionId?: string | null) {
  return sessionId ?? GLOBAL_DRAFT_SCOPE;
}

function getScopedDrafts(codeDrafts: CodeDraftMap, sessionId?: string | null) {
  return codeDrafts[getDraftScope(sessionId)] ?? {};
}

function storeDraft(
  codeDrafts: CodeDraftMap,
  sessionId: string | null | undefined,
  language: string,
  code: string,
) {
  const scope = getDraftScope(sessionId);

  return {
    ...codeDrafts,
    [scope]: {
      ...getScopedDrafts(codeDrafts, sessionId),
      [language]: code,
    },
  };
}

function getDraftedCode(
  codeDrafts: CodeDraftMap,
  sessionId: string | null | undefined,
  language: string,
  fallbackCode: string,
) {
  return getScopedDrafts(codeDrafts, sessionId)[language] ?? fallbackCode;
}

function normalizeTimedSessionStatus(session: Session) {
  if (
    session.status === 'scheduled' &&
    session.createdAt.getTime() <= Date.now()
  ) {
    return {
      ...session,
      status: 'active' as const,
    };
  }

  return session;
}

interface MentorshipState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  
  // View state
  currentView: 'dashboard' | 'workspace' | 'profile';
  
  // Session state
  currentSession: Session | null;
  sessions: Session[];
  
  // Chat state
  messages: Message[];
  
  // Editor state
  code: string;
  language: string;
  codeDrafts: CodeDraftMap;
  remoteCodeSyncVersion: number;
  stdin: string;
  
  // Video state
  isMuted: boolean;
  isCameraOff: boolean;
  
  // UI state
  leftPanelCollapsed: boolean;
  chatVisible: boolean;
  videoVisible: boolean;

  // Editor state
  editorVisible: boolean;
  editorMinimized: boolean;
  editorFocused: boolean;

  // Execution state
  isRunning: boolean;
  executionResult: ExecutionResult | null;
  outputPanelOpen: boolean;

  // Actions
  setUser: (user: User | null) => void;
  logout: () => void;
  setCurrentView: (view: 'dashboard' | 'workspace' | 'profile') => void;
  setCurrentSession: (session: Session | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  activateDueSessions: () => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  applyRemoteCodeUpdate: (code: string, language: string) => void;
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setStdin: (stdin: string) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleLeftPanel: () => void;
  toggleChat: () => void;
  toggleVideo: () => void;
  // Editor actions
  closeEditor: () => void;
  minimizeEditor: () => void;
  focusEditor: () => void;
  restoreEditor: () => void;
  toggleEditorFocus: () => void;
  endSession: () => void;
  joinSession: (session: Session) => void;
  leaveSession: () => void;
  // Execution actions
  setIsRunning: (running: boolean) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  clearExecutionResult: () => void;
  toggleOutputPanel: () => void;
}

export const useMentorshipStore = create<MentorshipState>((set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  currentView: 'dashboard',
  currentSession: null,
  sessions: [],
  messages: [],
  code: getDefaultCode(FALLBACK_LANGUAGE),
  language: FALLBACK_LANGUAGE,
  codeDrafts: {
    [GLOBAL_DRAFT_SCOPE]: {
      [FALLBACK_LANGUAGE]: getDefaultCode(FALLBACK_LANGUAGE),
    },
  },
  remoteCodeSyncVersion: 0,
  stdin: '',
  isMuted: true,
  isCameraOff: true,
  leftPanelCollapsed: false,
  chatVisible: true,
  videoVisible: true,
  // Editor state
  editorVisible: true,
  editorMinimized: false,
  editorFocused: false,

  // Execution state
  isRunning: false,
  executionResult: null,
  outputPanelOpen: true,

  // Actions
  setUser: (user) => set((state) => {
    const preferredLanguage = resolvePreferredLanguage(user?.defaultLanguage);
    const globalDrafts = storeDraft(
      state.codeDrafts,
      null,
      state.language,
      state.code,
    );
    const nextCode = shouldSwapToStarterCode(state.code)
      ? getDraftedCode(
          globalDrafts,
          null,
          preferredLanguage,
          getDefaultCode(preferredLanguage),
        )
      : state.code;

    if (state.currentSession) {
      return {
        user,
        isAuthenticated: !!user,
      };
    }

    return {
      user,
      isAuthenticated: !!user,
      language: preferredLanguage,
      code: nextCode,
      codeDrafts: storeDraft(globalDrafts, null, preferredLanguage, nextCode),
    };
  }),
  
  logout: () => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mentorship_user');
      sessionStorage.clear();
    }
    
    // Reset all state
    set({
      user: null,
      isAuthenticated: false,
      currentView: 'dashboard',
      currentSession: null,
      sessions: [],
      messages: [],
      chatVisible: true,
      videoVisible: true,
      leftPanelCollapsed: false,
      editorVisible: true,
      editorMinimized: false,
      editorFocused: false,
      code: getDefaultCode(FALLBACK_LANGUAGE),
      language: FALLBACK_LANGUAGE,
      codeDrafts: {
        [GLOBAL_DRAFT_SCOPE]: {
          [FALLBACK_LANGUAGE]: getDefaultCode(FALLBACK_LANGUAGE),
        },
      },
      stdin: '',
      isMuted: true,
      isCameraOff: true,
    });
  },
  
  setCurrentView: (view) => set({ currentView: view }),
  
  setCurrentSession: (session) => set({ 
    currentSession: session ? normalizeTimedSessionStatus(session) : null,
  }),
  
  setSessions: (sessions) => set({ 
    sessions: sessions.map(normalizeTimedSessionStatus),
  }),
  
  addSession: (session) => set((state) => ({ 
    sessions: [normalizeTimedSessionStatus(session), ...state.sessions] 
  })),

  updateSession: (session) => set((state) => {
    const sessions = state.sessions
      .map((existingSession) =>
        existingSession.id === session.id
          ? normalizeTimedSessionStatus(session)
          : normalizeTimedSessionStatus(existingSession),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      sessions,
      currentSession:
        state.currentSession?.id === session.id
          ? normalizeTimedSessionStatus(session)
          : state.currentSession
            ? normalizeTimedSessionStatus(state.currentSession)
            : state.currentSession,
    };
  }),

  activateDueSessions: () => set((state) => ({
    sessions: state.sessions.map(normalizeTimedSessionStatus),
    currentSession: state.currentSession
      ? normalizeTimedSessionStatus(state.currentSession)
      : null,
  })),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),

  setMessages: (messages) => set({ messages }),
  
  clearMessages: () => set({ messages: [] }),

  applyRemoteCodeUpdate: (code, language) =>
    set((state) => {
      if (state.code === code && state.language === language) {
        return state;
      }

      const nextDrafts = storeDraft(
        state.codeDrafts,
        state.currentSession?.id,
        language,
        code,
      );

      return {
        code,
        language,
        codeDrafts: nextDrafts,
        remoteCodeSyncVersion: state.remoteCodeSyncVersion + 1,
      };
    }),
  
  setCode: (code) => set((state) => ({
    code,
    codeDrafts: storeDraft(
      state.codeDrafts,
      state.currentSession?.id,
      state.language,
      code,
    ),
  })),
  
  setLanguage: (language) => set((state) => {
    const draftsWithCurrentLanguage = storeDraft(
      state.codeDrafts,
      state.currentSession?.id,
      state.language,
      state.code,
    );
    const nextCode = getDraftedCode(
      draftsWithCurrentLanguage,
      state.currentSession?.id,
      language,
      getDefaultCode(language),
    );

    return {
      language,
      code: nextCode,
      codeDrafts: storeDraft(
        draftsWithCurrentLanguage,
        state.currentSession?.id,
        language,
        nextCode,
      ),
    };
  }),

  setStdin: (stdin) => set({ stdin }),
  
  toggleMute: () => set((state) => ({ 
    isMuted: !state.isMuted 
  })),
  
  toggleCamera: () => set((state) => ({ 
    isCameraOff: !state.isCameraOff 
  })),
  
  toggleLeftPanel: () => set((state) => ({ 
    leftPanelCollapsed: !state.leftPanelCollapsed 
  })),
  
  toggleChat: () => set((state) => ({ 
    chatVisible: !state.chatVisible 
  })),
  
  toggleVideo: () => set((state) => ({
    videoVisible: !state.videoVisible
  })),

  // Editor actions
  closeEditor: () => set({
    editorVisible: false,
    editorMinimized: false,
    editorFocused: false
  }),

  minimizeEditor: () => set({
    editorVisible: false,
    editorMinimized: true,
    editorFocused: false
  }),

  focusEditor: () => set({
    editorVisible: true,
    editorMinimized: false,
    editorFocused: true,
    chatVisible: false,
    videoVisible: false,
  }),

  restoreEditor: () => set({
    editorVisible: true,
    editorMinimized: false,
    editorFocused: false,
  }),

  toggleEditorFocus: () => set((state) => {
    if (state.editorFocused) {
      // Exit focus mode - restore previous state
      return {
        editorFocused: false,
        chatVisible: true,
        videoVisible: true,
      };
    } else {
      // Enter focus mode
      return {
        editorFocused: true,
        chatVisible: false,
        videoVisible: false,
      };
    }
  }),

  endSession: () => set((state) => ({
    currentSession: state.currentSession 
      ? { ...state.currentSession, status: 'ended' } 
      : null,
    sessions: state.currentSession
      ? state.sessions.map((session) =>
          session.id === state.currentSession?.id
            ? { ...session, status: 'ended' }
            : session,
        )
      : state.sessions,
  })),
  
  joinSession: (session) => set((state) => {
    const preferredLanguage = resolvePreferredLanguage(state.user?.defaultLanguage);
    const hasStarterCodeOnly = !session.code || shouldSwapToStarterCode(session.code);
    const editorLanguage = hasStarterCodeOnly
      ? preferredLanguage
      : resolvePreferredLanguage(session.language || preferredLanguage);
    const fallbackCode = hasStarterCodeOnly
      ? getDefaultCode(editorLanguage)
      : session.code ?? getDefaultCode(editorLanguage);
    const editorCode = getDraftedCode(
      state.codeDrafts,
      session.id,
      editorLanguage,
      fallbackCode,
    );
    const nextDrafts = storeDraft(
      state.codeDrafts,
      session.id,
      editorLanguage,
      editorCode,
    );

    return {
      currentSession: normalizeTimedSessionStatus(session),
      currentView: 'workspace',
      messages: [],
      language: editorLanguage,
      code: editorCode,
      codeDrafts: nextDrafts,
      stdin: '',
      isMuted: true,
      isCameraOff: true,
      leftPanelCollapsed: false,
      chatVisible: true,
      videoVisible: true,
      editorVisible: true,
      editorMinimized: false,
      editorFocused: false,
    };
  }),
  
  leaveSession: () => set((state) => {
    const preferredLanguage = resolvePreferredLanguage(state.user?.defaultLanguage);
    const globalDrafts = storeDraft(
      state.codeDrafts,
      state.currentSession?.id,
      state.language,
      state.code,
    );
    const nextCode = getDraftedCode(
      globalDrafts,
      null,
      preferredLanguage,
      shouldSwapToStarterCode(state.code)
        ? getDefaultCode(preferredLanguage)
        : state.code,
    );

    return {
      currentSession: null,
      currentView: 'dashboard',
      messages: [],
      language: preferredLanguage,
      code: nextCode,
      codeDrafts: storeDraft(globalDrafts, null, preferredLanguage, nextCode),
      stdin: '',
      isMuted: true,
      isCameraOff: true,
    };
  }),

  // Execution actions
  setIsRunning: (isRunning) => set({ isRunning }),

  setExecutionResult: (executionResult) => set({ 
    executionResult,
    outputPanelOpen: true,
  }),

  clearExecutionResult: () => set({ 
    executionResult: null,
  }),

  toggleOutputPanel: () => set((state) => ({ 
    outputPanelOpen: !state.outputPanelOpen 
  })),
}));
