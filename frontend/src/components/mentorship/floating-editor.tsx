'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useMentorshipStore } from '@/store/mentorship-store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Copy, Download, RotateCcw, Maximize2, X, GripHorizontal } from 'lucide-react';
import { editor } from 'monaco-editor';
import { cn } from '@/lib/utils';
import { getDefaultCode } from '@/lib/default-code';
import { registerEditorSnippets } from '@/lib/monaco-snippets';
import { emitRealtimeCodeChange } from '@/lib/codelink-socket';

const MIN_FLOATING_EDITOR_WIDTH = 360;
const MIN_FLOATING_EDITOR_HEIGHT = 240;
const WINDOW_EDGE_PADDING = 16;
const RESIZE_CURSOR_MAP: Record<string, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

interface FloatingEditorProps {
  onClose: () => void;
  onExpand: () => void;
}

function getViewportBounds() {
  return {
    maxWidth: Math.max(MIN_FLOATING_EDITOR_WIDTH, window.innerWidth - WINDOW_EDGE_PADDING * 2),
    maxHeight: Math.max(MIN_FLOATING_EDITOR_HEIGHT, window.innerHeight - WINDOW_EDGE_PADDING * 2),
  };
}

export function FloatingEditor({ onClose, onExpand }: FloatingEditorProps) {
  const {
    currentSession,
    code,
    language,
    remoteCodeSyncVersion,
    setCode,
    setLanguage,
  } = useMentorshipStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const currentSessionId = currentSession?.id;
  const codeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRemoteCodeRef = useRef<string | null>(null);

  // Position and size state
  const [position, setPosition] = useState({
    x: Math.max(WINDOW_EDGE_PADDING, window.innerWidth - 580),
    y: 96,
  });
  const [size, setSize] = useState({ width: 540, height: 460 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  useEffect(() => {
    suppressRemoteCodeRef.current = code;
  }, [code, remoteCodeSyncVersion]);

  useEffect(() => {
    return () => {
      if (codeSyncTimeoutRef.current) {
        clearTimeout(codeSyncTimeoutRef.current);
      }
    };
  }, []);

  const queueCodeSync = useCallback((nextCode: string, nextLanguage: string) => {
    if (!currentSessionId) {
      return;
    }

    if (codeSyncTimeoutRef.current) {
      clearTimeout(codeSyncTimeoutRef.current);
    }

    codeSyncTimeoutRef.current = setTimeout(() => {
      emitRealtimeCodeChange(currentSessionId, nextCode, nextLanguage);
    }, 200);
  }, [currentSessionId]);

  useEffect(() => {
    const handleViewportResize = () => {
      const bounds = getViewportBounds();

      setSize((currentSize) => ({
        width: Math.min(currentSize.width, bounds.maxWidth),
        height: Math.min(currentSize.height, bounds.maxHeight),
      }));

      setPosition((currentPosition) => {
        const nextWidth = Math.min(size.width, bounds.maxWidth);
        const nextHeight = Math.min(size.height, bounds.maxHeight);

        return {
          x: Math.min(
            Math.max(WINDOW_EDGE_PADDING, currentPosition.x),
            Math.max(WINDOW_EDGE_PADDING, window.innerWidth - nextWidth - WINDOW_EDGE_PADDING),
          ),
          y: Math.min(
            Math.max(WINDOW_EDGE_PADDING, currentPosition.y),
            Math.max(WINDOW_EDGE_PADDING, window.innerHeight - nextHeight - WINDOW_EDGE_PADDING),
          ),
        };
      });
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [size.height, size.width]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[data-radix-collection-item]')) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const bounds = getViewportBounds();

      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPosition({
          x: Math.max(
            WINDOW_EDGE_PADDING,
            Math.min(
              window.innerWidth - size.width - WINDOW_EDGE_PADDING,
              dragStart.current.posX + dx,
            ),
          ),
          y: Math.max(
            WINDOW_EDGE_PADDING,
            Math.min(
              window.innerHeight - size.height - WINDOW_EDGE_PADDING,
              dragStart.current.posY + dy,
            ),
          ),
        });
      }
      if (isResizing && resizeDir) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;

        if (resizeDir.includes('e')) {
          setSize(prev => ({
            ...prev,
            width: Math.min(
              bounds.maxWidth,
              Math.max(MIN_FLOATING_EDITOR_WIDTH, resizeStart.current.width + dx),
            ),
          }));
        }
        if (resizeDir.includes('s')) {
          setSize(prev => ({
            ...prev,
            height: Math.min(
              bounds.maxHeight,
              Math.max(MIN_FLOATING_EDITOR_HEIGHT, resizeStart.current.height + dy),
            ),
          }));
        }
        if (resizeDir.includes('w')) {
          const maxWidthFromLeft = resizeStart.current.posX + resizeStart.current.width - WINDOW_EDGE_PADDING;
          const newWidth = Math.min(
            bounds.maxWidth,
            Math.max(MIN_FLOATING_EDITOR_WIDTH, resizeStart.current.width - dx),
          );
          const nextX = resizeStart.current.posX + (resizeStart.current.width - newWidth);

          if (newWidth >= MIN_FLOATING_EDITOR_WIDTH && nextX >= WINDOW_EDGE_PADDING) {
            setSize(prev => ({ ...prev, width: newWidth }));
            setPosition(prev => ({
              ...prev,
              x: Math.min(maxWidthFromLeft - MIN_FLOATING_EDITOR_WIDTH, nextX),
            }));
          }
        }
        if (resizeDir.includes('n')) {
          const maxHeightFromTop = resizeStart.current.posY + resizeStart.current.height - WINDOW_EDGE_PADDING;
          const newHeight = Math.min(
            bounds.maxHeight,
            Math.max(MIN_FLOATING_EDITOR_HEIGHT, resizeStart.current.height - dy),
          );
          const nextY = resizeStart.current.posY + (resizeStart.current.height - newHeight);

          if (newHeight >= MIN_FLOATING_EDITOR_HEIGHT && nextY >= WINDOW_EDGE_PADDING) {
            setSize(prev => ({ ...prev, height: newHeight }));
            setPosition(prev => ({
              ...prev,
              y: Math.min(maxHeightFromTop - MIN_FLOATING_EDITOR_HEIGHT, nextY),
            }));
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDir(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging || isResizing) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor =
        isResizing && resizeDir ? RESIZE_CURSOR_MAP[resizeDir] ?? 'default' : 'move';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDir, size.height, size.width]);

  const startResize = useCallback((dir: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDir(dir);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  }, [size, position]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('codelink-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'e6edf3' },
        { token: 'constant', foreground: '79c0ff' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': '#264f78',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editorCursor.foreground': '#58a6ff',
        'editorIndentGuide.background': '#21262d',
        'editorIndentGuide.activeBackground': '#30363d',
      },
    });

    registerEditorSnippets(monaco);
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const copyCode = useCallback(() => {
    if (editorRef.current) {
      navigator.clipboard.writeText(editorRef.current.getValue());
    }
  }, []);

  const downloadCode = useCallback(() => {
    if (editorRef.current) {
      const codeValue = editorRef.current.getValue();
      const extensions: Record<string, string> = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        java: 'java',
        cpp: 'cpp',
      };
      const blob = new Blob([codeValue], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solution.${extensions[language] || 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [language]);

  const resetCode = useCallback(() => {
    const nextCode = getDefaultCode(language);
    setCode(nextCode);
    queueCodeSync(nextCode, language);
  }, [language, queueCodeSync, setCode]);

  const handleEditorChange = useCallback((value?: string) => {
    const nextCode = value || '';

    if (
      suppressRemoteCodeRef.current !== null &&
      nextCode === suppressRemoteCodeRef.current
    ) {
      suppressRemoteCodeRef.current = null;
      return;
    }

    setCode(nextCode);
    queueCodeSync(nextCode, language);
  }, [language, queueCodeSync, setCode]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    const nextCode = useMentorshipStore.getState().code;
    queueCodeSync(nextCode, newLanguage);
  }, [queueCodeSync, setLanguage]);

  return (
    <div
      className="floating-editor-window flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Resize handles */}
      <div className="floating-editor-resize-edge floating-editor-resize-edge-top" onMouseDown={startResize('n')} />
      <div className="floating-editor-resize-edge floating-editor-resize-edge-bottom" onMouseDown={startResize('s')} />
      <div className="floating-editor-resize-edge floating-editor-resize-edge-left" onMouseDown={startResize('w')} />
      <div className="floating-editor-resize-edge floating-editor-resize-edge-right" onMouseDown={startResize('e')} />
      <div className="floating-editor-resize-corner floating-editor-resize-corner-nw" onMouseDown={startResize('nw')} />
      <div className="floating-editor-resize-corner floating-editor-resize-corner-ne" onMouseDown={startResize('ne')} />
      <div className="floating-editor-resize-corner floating-editor-resize-corner-sw" onMouseDown={startResize('sw')} />
      <div className="floating-editor-resize-corner floating-editor-resize-corner-se" onMouseDown={startResize('se')}>
        <span className="pointer-events-none absolute bottom-[3px] right-[3px] h-3.5 w-3.5 rounded-sm border-r border-b border-primary/60" />
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-card shrink-0 cursor-move select-none"
        onMouseDown={handleMouseDown}
        onDoubleClick={onExpand}
      >
        <div className="flex items-center gap-2">
          {/* macOS-style controls */}
          <div className="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="w-3 h-3 rounded-full bg-[#f85149] hover:bg-[#ff6b6b] transition-colors flex items-center justify-center group"
                  >
                    <X className="w-1.5 h-1.5 text-[#1b1610] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Close</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-3 h-3 rounded-full bg-[#d29922] hover:bg-[#f0b429] transition-colors flex items-center justify-center">
                    <GripHorizontal className="w-1.5 h-1.5 text-[#1b1610] opacity-0 hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Minimized</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onExpand}
                    className="w-3 h-3 rounded-full bg-[#3fb950] hover:bg-[#56d364] transition-colors flex items-center justify-center group"
                  >
                    <Maximize2 className="w-1.5 h-1.5 text-[#1b1610] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Expand to full editor</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <span className="text-[10px] text-muted-foreground ml-1">
            solution.{language === 'javascript' ? 'js' : language}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-24 h-6 bg-secondary border-border text-[10px] text-foreground">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {LANGUAGES.map((lang) => (
                <SelectItem
                  key={lang.value}
                  value={lang.value}
                  className="text-foreground text-[10px] focus:bg-secondary"
                >
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={copyCode}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={downloadCode}
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={resetCode}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleEditorChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          theme="codelink-dark"
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontLigatures: true,
            lineHeight: 18,
            padding: { top: 4, bottom: 4 },
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            suggestOnTriggerCharacters: true,
            snippetSuggestions: 'top',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>
    </div>
  );
}
