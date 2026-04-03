'use client';

import { useEffect } from 'react';
import {
  connectCodeLinkSocket,
  emitRealtimeCodeChange,
  joinRealtimeSession,
} from '@/lib/codelink-socket';
import { mapApiMessage } from '@/lib/session-api';
import { useMentorshipStore } from '@/store/mentorship-store';

export function useSessionRealtime() {
  const currentSessionId = useMentorshipStore((state) => state.currentSession?.id);
  const userId = useMentorshipStore((state) => state.user?.id);
  const addMessage = useMentorshipStore((state) => state.addMessage);
  const applyRemoteCodeUpdate = useMentorshipStore((state) => state.applyRemoteCodeUpdate);
  const setMessages = useMentorshipStore((state) => state.setMessages);

  useEffect(() => {
    if (!currentSessionId || !userId) {
      return;
    }

    let isActive = true;
    const socket = connectCodeLinkSocket();

    if (!socket) {
      return;
    }

    const joinSessionRoom = async () => {
      try {
        await joinRealtimeSession(currentSessionId);
      } catch (error) {
        console.error('Failed to join realtime session:', error);
      }
    };

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/session/${currentSessionId}/messages`);
        const data = await response.json();

        if (!response.ok || !isActive) {
          return;
        }

        setMessages((data.messages ?? []).map(mapApiMessage));
      } catch (error) {
        console.error('Failed to load realtime messages:', error);
      }
    };

    const handleReceiveMessage = (message: Parameters<typeof mapApiMessage>[0]) => {
      const state = useMentorshipStore.getState();

      if (state.currentSession?.id !== currentSessionId) {
        return;
      }

      if (state.messages.some((existingMessage) => existingMessage.id === message.id)) {
        return;
      }

      addMessage(mapApiMessage(message));
    };

    const handleCodeUpdate = (payload: { code: string; language: string }) => {
      const state = useMentorshipStore.getState();

      if (state.currentSession?.id !== currentSessionId) {
        return;
      }

      applyRemoteCodeUpdate(payload.code, payload.language);
    };

    const handleUserJoined = (payload: { sessionId: string; userId: string }) => {
      const state = useMentorshipStore.getState();

      if (
        payload.sessionId !== currentSessionId ||
        payload.userId === state.user?.id ||
        state.currentSession?.id !== currentSessionId
      ) {
        return;
      }

      emitRealtimeCodeChange(currentSessionId, state.code, state.language);
    };

    const handleConnect = () => {
      void joinSessionRoom();
    };

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('code-update', handleCodeUpdate);
    socket.on('user-joined', handleUserJoined);

    if (socket.connected) {
      void joinSessionRoom();
    }

    void loadMessages();

    return () => {
      isActive = false;
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('code-update', handleCodeUpdate);
      socket.off('user-joined', handleUserJoined);
    };
  }, [addMessage, applyRemoteCodeUpdate, currentSessionId, setMessages, userId]);
}
