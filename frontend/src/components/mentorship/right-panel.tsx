'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useMentorshipStore } from '@/store/mentorship-store';
import type { SessionWebRtcState } from '@/hooks/use-session-webrtc';
import { Send, Mic, MicOff, VideoIcon, VideoOff, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  emitTypingStart,
  emitTypingStop,
  sendRealtimeMessage,
} from '@/lib/codelink-socket';
import { toast } from '@/hooks/use-toast';

interface RightPanelProps {
  videoCall: SessionWebRtcState;
  stacked?: boolean;
}

type VideoSectionProps = SessionWebRtcState & {
  stacked?: boolean;
};

// Vertical resize handle
function VerticalResizeHandle() {
  return (
    <PanelResizeHandle className="group relative">
      <div className="absolute inset-0 z-10 cursor-row-resize" />
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border group-hover:bg-primary/50 transition-colors" />
    </PanelResizeHandle>
  );
}

function ChatSection() {
  const [input, setInput] = useState('');
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const { currentSession, messages, user } = useMentorshipStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentSessionId = currentSession?.id;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (currentSessionId && isTypingRef.current) {
        emitTypingStop(currentSessionId);
      }
    };
  }, [currentSessionId]);

  const stopTyping = useCallback(() => {
    if (!currentSessionId || !isTypingRef.current) {
      return;
    }

    emitTypingStop(currentSessionId);
    isTypingRef.current = false;
  }, [currentSessionId]);

  const scheduleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 900);
  }, [stopTyping]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || !currentSessionId) return;

    try {
      await sendRealtimeMessage(currentSessionId, input.trim());
      stopTyping();
      setInput('');
    } catch (error) {
      console.error('Failed to send realtime message:', error);
    }
  }, [currentSessionId, input, stopTyping, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (nextValue: string) => {
    setInput(nextValue);

    if (!currentSessionId) {
      return;
    }

    if (!nextValue.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      emitTypingStart(currentSessionId);
      isTypingRef.current = true;
    }

    scheduleTypingStop();
  };

  const handleDeleteChat = useCallback(async () => {
    if (!currentSessionId || messages.length === 0 || isDeletingChat) {
      return;
    }

    const confirmed = window.confirm(
      'Delete all chat messages in this session for everyone?',
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingChat(true);

    try {
      stopTyping();
      const response = await fetch(`/api/session/${currentSessionId}/messages`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete chat messages');
      }

      setInput('');
      toast({
        title: 'Chat deleted',
        description: 'All messages were removed from this session.',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to delete chat messages:', error);
      toast({
        title: error instanceof Error ? error.message : 'Failed to delete chat messages',
        type: 'error',
      });
    } finally {
      setIsDeletingChat(false);
    }
  }, [currentSessionId, isDeletingChat, messages.length, stopTyping]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Chat</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground"
          onClick={handleDeleteChat}
          disabled={!currentSessionId || messages.length === 0 || isDeletingChat}
          title="Delete all chat messages"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {isDeletingChat ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-2" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-4">
            <MessageSquare className="h-6 w-6 mb-2 opacity-30" />
            <p className="text-xs">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-1.5",
                  message.senderId === user?.id && "flex-row-reverse"
                )}
              >
                <Avatar className="h-5 w-5 shrink-0 border border-border">
                  <AvatarFallback
                    className={cn(
                      "text-[10px]",
                      message.senderRole === 'mentor'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-[#3fb950]/10 text-[#3fb950]'
                    )}
                  >
                    {message.senderName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    message.senderId === user?.id ? "items-end" : "items-start"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-foreground">
                      {message.senderName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "px-2 py-1 rounded text-xs break-words",
                      message.senderId === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground'
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-2 border-t border-border shrink-0">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-7 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs"
          />
          <Button
            size="icon"
            className="h-7 w-7 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || !currentSessionId}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoSection({
  callStatus,
  hasLocalStream,
  hasRemoteStream,
  localVideoRef,
  remoteVideoRef,
  stacked = false,
}: VideoSectionProps) {
  const {
    currentSession,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    user,
  } = useMentorshipStore();
  const isMentor = user?.role === 'mentor';
  const mentorName = currentSession?.mentorName || (isMentor ? user?.name : 'Mentor') || 'Mentor';
  const studentName =
    currentSession?.studentName || (!isMentor ? user?.name : 'Student') || 'Student';
  const localParticipantName = isMentor ? mentorName : studentName;
  const remoteParticipantName = isMentor ? studentName : mentorName;

  return (
    <div className="flex flex-col h-full">
      {/* Video Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Video Call</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {callStatus}
        </span>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className={cn('grid h-full gap-2', stacked ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
          <div className="relative bg-secondary rounded border border-border overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'h-full w-full object-cover bg-black',
                (!hasLocalStream || isCameraOff) && 'opacity-0',
              )}
            />
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white z-10">
              {isMentor ? 'Mentor' : 'Student'}
            </div>
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between rounded bg-black/55 px-2 py-1 text-[10px] text-white">
              <span className="truncate">{localParticipantName} (You)</span>
              <span>{isMuted ? 'Mic Off' : 'Mic On'}</span>
            </div>
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary',
                hasLocalStream && !isCameraOff && 'pointer-events-none opacity-0',
              )}
            >
              <Avatar className="h-10 w-10 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {localParticipantName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground">
                {isCameraOff ? 'Camera is off' : 'Starting camera...'}
              </span>
            </div>
          </div>

          <div className="relative bg-secondary rounded border border-border overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                'h-full w-full object-cover bg-black',
                !hasRemoteStream && 'opacity-0',
              )}
            />
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white z-10">
              {isMentor ? 'Student' : 'Mentor'}
            </div>
            <div className="absolute bottom-1 left-1 right-1 rounded bg-black/55 px-2 py-1 text-[10px] text-white">
              <span className="truncate block">{remoteParticipantName}</span>
            </div>
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary',
                hasRemoteStream && 'pointer-events-none opacity-0',
              )}
            >
              <Avatar className="h-10 w-10 border-2 border-[#3fb950]/30">
                <AvatarFallback className="bg-[#3fb950]/10 text-[#3fb950] text-sm">
                  {remoteParticipantName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground text-center px-4">
                {callStatus === 'Connected'
                  ? 'Connected'
                  : 'Waiting for the other participant...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-2 p-2 border-t border-border shrink-0">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          className="h-8 w-8"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant={isCameraOff ? 'destructive' : 'secondary'}
          size="icon"
          className="h-8 w-8"
          onClick={toggleCamera}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? (
            <VideoOff className="h-4 w-4" />
          ) : (
            <VideoIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function RightPanel({ videoCall, stacked = false }: RightPanelProps) {
  const { chatVisible, videoVisible } = useMentorshipStore();
  const shellClassName = cn(
    'h-full bg-card',
    stacked ? 'border-t border-border' : 'border-l border-border',
  );

  // If both are hidden, don't render
  if (!chatVisible && !videoVisible) {
    return null;
  }

  // Only chat visible - full height
  if (chatVisible && !videoVisible) {
    return (
      <div className={cn(shellClassName, 'flex flex-col')}>
        <ChatSection />
      </div>
    );
  }

  // Only video visible - full height
  if (!chatVisible && videoVisible) {
    return (
      <div className={cn(shellClassName, 'flex flex-col')}>
        <VideoSection {...videoCall} stacked={stacked} />
      </div>
    );
  }

  // Both visible - resizable split view
  return (
    <div className={shellClassName}>
      <PanelGroup
        direction="vertical"
        autoSaveId={stacked ? 'workspace-right-panel-stacked' : 'workspace-right-panel-side'}
        className="h-full"
      >
        <Panel defaultSize={55} minSize={30}>
          <ChatSection />
        </Panel>
        <VerticalResizeHandle />
        <Panel defaultSize={45} minSize={25}>
          <VideoSection {...videoCall} stacked={stacked} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
