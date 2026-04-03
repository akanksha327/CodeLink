'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { LeftPanel } from './left-panel';
import { CodeEditor } from './code-editor';
import { FloatingEditor } from './floating-editor';
import { RightPanel } from './right-panel';
import { useMentorshipStore } from '@/store/mentorship-store';
import { useSessionRealtime } from '@/hooks/use-session-realtime';
import { useSessionWebRtc } from '@/hooks/use-session-webrtc';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Video,
  Users,
  MessageSquareOff,
  VideoOff,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Code2,
  GitBranch,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function ResizeHandle({ direction = 'horizontal' }: { direction?: 'horizontal' | 'vertical' }) {
  return (
    <PanelResizeHandle className="group relative">
      <div
        className={`
          absolute z-10 transition-colors duration-150
          ${direction === 'horizontal'
            ? 'w-1.5 h-full cursor-col-resize'
            : 'h-1.5 w-full cursor-row-resize'
          }
          hover:bg-primary/20
          ${direction === 'horizontal' ? 'left-0' : 'top-0'}
        `}
      />
      <div
        className={`
          absolute transition-colors duration-150
          ${direction === 'horizontal'
            ? 'w-px h-full left-1/2 -translate-x-1/2'
            : 'h-px w-full top-1/2 -translate-y-1/2'
          }
          bg-border group-hover:bg-primary/50
        `}
      />
    </PanelResizeHandle>
  );
}

function LeftSidebarToggle() {
  const { leftPanelCollapsed, toggleLeftPanel } = useMentorshipStore();

  if (!leftPanelCollapsed) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleLeftPanel}
            className={cn(
              'fixed left-0 top-1/2 z-50 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-card text-muted-foreground transition-all duration-200 hover:bg-secondary/50 hover:text-primary',
              'group'
            )}
          >
            <PanelLeft className="h-4 w-4 transition-transform group-hover:scale-110" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">Open Panel <kbd className="ml-1 rounded bg-[#30363d] px-1 py-0.5 text-[10px]">Ctrl/Cmd+B</kbd></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RightSidebarToggle() {
  const { chatVisible, videoVisible, toggleChat } = useMentorshipStore();

  const rightPanelHidden = !chatVisible && !videoVisible;

  if (!rightPanelHidden) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleChat}
            className={cn(
              'fixed right-0 top-1/2 z-50 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border bg-card text-muted-foreground transition-all duration-200 hover:bg-secondary/50 hover:text-primary',
              'group'
            )}
          >
            <PanelRight className="h-4 w-4 transition-transform group-hover:scale-110" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">Open Chat</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EditorToggle() {
  const { editorVisible, editorMinimized, restoreEditor } = useMentorshipStore();

  if (editorVisible || editorMinimized) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={restoreEditor}
            className={cn(
              'fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-muted-foreground shadow-lg transition-all duration-200 hover:bg-secondary/50 hover:text-primary',
              'group'
            )}
          >
            <Code2 className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="text-xs font-medium">Open Editor</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Restore Code Editor</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MobileBottomActions({
  isMobileLeftPanelOpen,
  setIsMobileLeftPanelOpen,
}: {
  isMobileLeftPanelOpen: boolean;
  setIsMobileLeftPanelOpen: (open: boolean) => void;
}) {
  const { chatVisible, videoVisible, toggleChat, toggleVideo } = useMentorshipStore();

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border bg-card p-2">
      <Sheet open={isMobileLeftPanelOpen} onOpenChange={setIsMobileLeftPanelOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Users className="mr-2 h-4 w-4" />
            Session
          </Button>
        </SheetTrigger>
      </Sheet>

      <Button
        variant={chatVisible ? 'default' : 'outline'}
        size="sm"
        className={chatVisible ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
        aria-label={chatVisible ? 'Hide chat panel' : 'Show chat panel'}
        aria-pressed={chatVisible}
        onClick={toggleChat}
      >
        {chatVisible ? (
          <>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat On
          </>
        ) : (
          <>
            <MessageSquareOff className="mr-2 h-4 w-4" />
            Chat Off
          </>
        )}
      </Button>

      <Button
        variant={videoVisible ? 'default' : 'outline'}
        size="sm"
        className={videoVisible ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
        aria-label={videoVisible ? 'Hide video panel' : 'Show video panel'}
        aria-pressed={videoVisible}
        onClick={toggleVideo}
      >
        {videoVisible ? (
          <>
            <Video className="mr-2 h-4 w-4" />
            Video On
          </>
        ) : (
          <>
            <VideoOff className="mr-2 h-4 w-4" />
            Video Off
          </>
        )}
      </Button>
    </div>
  );
}

function CompactWorkspaceControls({
  isSessionPanelOpen,
  setIsSessionPanelOpen,
}: {
  isSessionPanelOpen: boolean;
  setIsSessionPanelOpen: (open: boolean) => void;
}) {
  const { chatVisible, videoVisible, toggleChat, toggleVideo } = useMentorshipStore();

  return (
    <div className="border-b border-border bg-card/90 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Sheet open={isSessionPanelOpen} onOpenChange={setIsSessionPanelOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-border text-muted-foreground hover:text-foreground"
            >
              <Users className="mr-2 h-4 w-4" />
              Session
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-border bg-card p-0">
            <LeftPanel onCollapse={() => setIsSessionPanelOpen(false)} />
          </SheetContent>
        </Sheet>

        <Button
          variant={chatVisible ? 'default' : 'outline'}
          size="sm"
          className={chatVisible ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
          aria-label={chatVisible ? 'Hide chat panel' : 'Show chat panel'}
          aria-pressed={chatVisible}
          onClick={toggleChat}
        >
          {chatVisible ? (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat On
            </>
          ) : (
            <>
              <MessageSquareOff className="mr-2 h-4 w-4" />
              Chat Off
            </>
          )}
        </Button>

        <Button
          variant={videoVisible ? 'default' : 'outline'}
          size="sm"
          className={videoVisible ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
          aria-label={videoVisible ? 'Hide video panel' : 'Show video panel'}
          aria-pressed={videoVisible}
          onClick={toggleVideo}
        >
          {videoVisible ? (
            <>
              <Video className="mr-2 h-4 w-4" />
              Video On
            </>
          ) : (
            <>
              <VideoOff className="mr-2 h-4 w-4" />
              Video Off
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function WorkspaceNav() {
  const {
    user,
    currentSession,
    leaveSession,
    chatVisible,
    videoVisible,
    toggleChat,
    toggleVideo,
    editorVisible,
    editorMinimized,
    editorFocused,
    restoreEditor,
  } = useMentorshipStore();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-card/90 px-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={leaveSession}
                className="h-7 w-7 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Back to Dashboard <kbd className="ml-1 rounded bg-secondary px-1 py-0.5 text-[10px]">Esc</kbd></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border" />

        <div className="ml-1 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(240,246,252,0.03)]">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
            <span className="text-[10px] font-bold text-primary">CL</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
            <p className="text-sm font-medium text-foreground">CodeLink</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {currentSession && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <div className={`h-1.5 w-1.5 rounded-full ${currentSession.status === 'active' ? 'bg-[#3fb950] animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="max-w-[120px] truncate text-xs font-medium text-foreground sm:max-w-[220px]">
              <span className="text-primary/80">session/</span>
              {currentSession.title}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {(!editorVisible || editorMinimized) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={restoreEditor}
                  className="h-7 border-primary/30 text-xs text-primary hover:bg-primary/10"
                >
                  <Code2 className="mr-1 h-3 w-3" />
                  Editor
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Restore Editor</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {editorFocused && (
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            FOCUS MODE
          </span>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (chatVisible || videoVisible) {
                    if (chatVisible) toggleChat();
                    if (videoVisible) toggleVideo();
                  } else {
                    toggleChat();
                  }
                }}
                className="h-7 w-7 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {chatVisible || videoVisible ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRight className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{chatVisible || videoVisible ? 'Hide' : 'Show'} Chat Panel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border" />

        {user && (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">{user.name}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary">
              <span className="text-[10px] font-medium text-foreground">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export function Workspace() {
  const {
    chatVisible,
    videoVisible,
    leaveSession,
    leftPanelCollapsed,
    toggleLeftPanel,
    editorVisible,
    editorMinimized,
    restoreEditor,
    editorFocused,
  } = useMentorshipStore();

  useSessionRealtime();
  const videoCall = useSessionWebRtc();

  const [isMobileLeftPanelOpen, setIsMobileLeftPanelOpen] = useState(false);
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'mobile' | 'compact' | 'desktop'>('desktop');

  useEffect(() => {
    const syncLayoutMode = () => {
      const width = window.innerWidth;

      if (width < 768) {
        setLayoutMode('mobile');
        return;
      }

      if (width < 1280) {
        setLayoutMode('compact');
        return;
      }

      setLayoutMode('desktop');
    };

    syncLayoutMode();
    window.addEventListener('resize', syncLayoutMode);

    return () => window.removeEventListener('resize', syncLayoutMode);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        leaveSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLeftPanel, leaveSession]);

  const showRightPanel = chatVisible || videoVisible;
  const showEditor = editorVisible && !editorMinimized;
  const isMobile = layoutMode === 'mobile';
  const isCompactLayout = layoutMode === 'compact';

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <WorkspaceNav />

        <main className="flex-1 overflow-hidden">
          <CodeEditor />
        </main>

        <MobileBottomActions
          isMobileLeftPanelOpen={isMobileLeftPanelOpen}
          setIsMobileLeftPanelOpen={setIsMobileLeftPanelOpen}
        />

        <Sheet open={isMobileLeftPanelOpen} onOpenChange={setIsMobileLeftPanelOpen}>
          <SheetContent side="left" className="w-72 border-border bg-card p-0">
            <LeftPanel onCollapse={() => setIsMobileLeftPanelOpen(false)} />
          </SheetContent>
        </Sheet>

        <Sheet open={isMobileRightPanelOpen} onOpenChange={setIsMobileRightPanelOpen}>
          <SheetContent side="right" className="w-80 border-border bg-card p-0">
            {showRightPanel && <RightPanel videoCall={videoCall} />}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  if (isCompactLayout) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <WorkspaceNav />
        <CompactWorkspaceControls
          isSessionPanelOpen={isMobileLeftPanelOpen}
          setIsSessionPanelOpen={setIsMobileLeftPanelOpen}
        />

        <div className="flex-1 overflow-hidden">
          {(showEditor || showRightPanel) ? (
            <PanelGroup
              direction="vertical"
              autoSaveId="workspace-compact-layout"
              className="h-full"
            >
              {showEditor && (
                <Panel defaultSize={showRightPanel ? 62 : 100} minSize={35}>
                  <div className="h-full bg-background p-1.5">
                    <CodeEditor />
                  </div>
                </Panel>
              )}

              {showEditor && showRightPanel && <ResizeHandle direction="vertical" />}

              {showRightPanel && (
                <Panel defaultSize={showEditor ? 38 : 100} minSize={28} className="bg-card">
                  <RightPanel videoCall={videoCall} stacked />
                </Panel>
              )}
            </PanelGroup>
          ) : (
            <div className="flex h-full items-center justify-center bg-background">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-secondary/50">
                  <Code2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-4 text-sm text-muted-foreground">Editor is hidden</p>
                <Button
                  variant="outline"
                  onClick={restoreEditor}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Code2 className="mr-2 h-4 w-4" />
                  Open Editor
                </Button>
              </div>
            </div>
          )}
        </div>

        {editorMinimized && (
          <FloatingEditor
            onClose={() => useMentorshipStore.getState().closeEditor()}
            onExpand={restoreEditor}
          />
        )}
      </div>
    );
  }

  const getCenterSize = () => {
    if (editorFocused) return 100;
    if (!showEditor && showRightPanel) return 0;
    if (showEditor && !showRightPanel) return leftPanelCollapsed ? 100 : 82;
    if (!showEditor && !showRightPanel) return 0;
    return leftPanelCollapsed ? 73 : 55;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <WorkspaceNav />

      <div className="relative flex-1 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          autoSaveId="workspace-desktop-layout"
          className="h-full"
        >
          {!leftPanelCollapsed && !editorFocused && (
            <>
              <Panel
                defaultSize={18}
                minSize={15}
                maxSize={30}
                className="bg-card"
              >
                <LeftPanel onCollapse={toggleLeftPanel} />
              </Panel>
              <ResizeHandle />
            </>
          )}

          {showEditor && (
            <Panel defaultSize={getCenterSize()} minSize={40}>
              <div className="h-full bg-background p-1.5">
                <CodeEditor />
              </div>
            </Panel>
          )}

          {showRightPanel && !editorFocused && (
            <>
              {showEditor && <ResizeHandle />}
              <Panel
                defaultSize={showEditor ? 27 : 50}
                minSize={20}
                maxSize={40}
                className="bg-card"
              >
                <RightPanel videoCall={videoCall} />
              </Panel>
            </>
          )}
        </PanelGroup>

        {!showEditor && !showRightPanel && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-secondary/50">
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mb-4 text-sm text-muted-foreground">Editor is hidden</p>
              <Button
                variant="outline"
                onClick={restoreEditor}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <Code2 className="mr-2 h-4 w-4" />
                Open Editor
              </Button>
            </div>
          </div>
        )}

        <LeftSidebarToggle />
        <RightSidebarToggle />
        <EditorToggle />
      </div>

      {editorMinimized && (
        <FloatingEditor
          onClose={() => useMentorshipStore.getState().closeEditor()}
          onExpand={restoreEditor}
        />
      )}
    </div>
  );
}
