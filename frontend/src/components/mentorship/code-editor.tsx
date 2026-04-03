'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react';
import { useMentorshipStore } from '@/store/mentorship-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Play, 
  ChevronUp, 
  ChevronDown, 
  Trash2,
  Clock,
  Cpu,
  AlertCircle,
  CheckCircle,
  Terminal,
  X,
  Minus,
  Maximize2,
  Copy,
  Download,
  RotateCcw
} from 'lucide-react';
import { editor } from 'monaco-editor';
import { cn } from '@/lib/utils';
import { getDefaultCode } from '@/lib/default-code';
import { registerEditorSnippets } from '@/lib/monaco-snippets';
import { emitRealtimeCodeChange } from '@/lib/codelink-socket';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

// Output Panel Component
function OutputPanel() {
  const { 
    stdin,
    setStdin,
    executionResult, 
    isRunning, 
    outputPanelOpen, 
    toggleOutputPanel, 
    clearExecutionResult 
  } = useMentorshipStore();
  const [outputHeight, setOutputHeight] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');
  
  // Use refs to track values during resize without causing re-renders
  const resizeStartY = useRef(0);
  const currentHeightRef = useRef(220);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentHeightRef.current = outputHeight;
  }, [outputHeight]);

  useEffect(() => {
    if (isRunning || executionResult) {
      const timeoutId = window.setTimeout(() => {
        setActiveTab('output');
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [executionResult, isRunning]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    // Capture current height from ref (always up-to-date)

    const startHeight = currentHeightRef.current;

    const onMouseMove = (e: MouseEvent) => {
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        const delta = resizeStartY.current - e.clientY;
        const newHeight = Math.max(180, Math.min(520, startHeight + delta));
        setOutputHeight(newHeight);
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Prevent text selection during resize
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []); // Empty deps - we use refs for all values needed during resize

  const getStatusIcon = () => {
    if (activeTab === 'input') {
      return <Terminal className="w-3 h-3 text-muted-foreground" />;
    }
    if (isRunning) {
      return <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
    }
    if (!executionResult) {
      return <Terminal className="w-3 h-3 text-muted-foreground" />;
    }
    if (executionResult.statusCode === 3 || executionResult.status === 'Accepted') {
      return <CheckCircle className="w-3 h-3 text-[#3fb950]" />;
    }
    return <AlertCircle className="w-3 h-3 text-red-500" />;
  };

  const getStatusColor = () => {
    if (!executionResult) return 'text-muted-foreground';
    if (executionResult.statusCode === 3 || executionResult.status === 'Accepted') {
      return 'text-[#3fb950]';
    }
    return 'text-red-500';
  };

  return (
    <div 
      className={cn(
        "border-t border-border bg-[#0d1117] transition-all duration-200",
        outputPanelOpen ? "" : "h-8"
      )}
      style={{ height: outputPanelOpen ? outputHeight : 32 }}
      suppressHydrationWarning
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'input' | 'output')}
        className="h-full gap-0"
      >
        {outputPanelOpen && (
          <div
            className={cn(
              "h-1 w-full cursor-row-resize hover:bg-primary/20 transition-colors",
              isResizing && "bg-primary/30"
            )}
            onMouseDown={handleResizeStart}
          />
        )}

        <div className="flex items-center justify-between border-b border-border bg-[#161b22] px-3 h-8">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-[11px] font-medium text-foreground">Console</span>
            {outputPanelOpen && (
              <TabsList className="h-6 rounded-md bg-[#0d1117] p-0.5">
                <TabsTrigger value="input" className="h-5 px-2 text-[10px]">
                  Input
                </TabsTrigger>
                <TabsTrigger value="output" className="h-5 px-2 text-[10px]">
                  Output
                </TabsTrigger>
              </TabsList>
            )}
            {activeTab === 'output' && executionResult && (
              <span className={cn("text-[10px] font-medium", getStatusColor())}>
                {executionResult.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeTab === 'output' && executionResult && (
              <>
                <div className="mr-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{executionResult.time}</span>
                  <Cpu className="w-3 h-3 ml-2" />
                  <span>{executionResult.memory}</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={clearExecutionResult}
                        className="rounded p-1 transition-colors hover:bg-secondary"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Clear Output</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {activeTab === 'input' && outputPanelOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setStdin('')}
                disabled={!stdin}
              >
                Clear Input
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleOutputPanel}
                    className="rounded p-1 transition-colors hover:bg-secondary"
                  >
                    {outputPanelOpen ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{outputPanelOpen ? 'Collapse' : 'Expand'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {outputPanelOpen && (
          <div
            className="font-mono text-[12px] leading-relaxed"
            style={{ height: outputHeight - 32 - 4 }}
            suppressHydrationWarning
          >
            <TabsContent value="input" className="mt-0 h-full">
              <div className="flex h-full flex-col gap-2 bg-[#161b22] p-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Custom Input
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">
                    Type exactly what your program should read from stdin, just like an online compiler.
                  </div>
                </div>
                <Textarea
                  value={stdin}
                  onChange={(event) => setStdin(event.target.value)}
                  placeholder={'Example:\n4\n2 7 11 15\n9'}
                  className="h-full min-h-0 flex-1 resize-none border-border bg-[#0d1117] px-3 py-2 text-[#e6edf3] text-[12px] placeholder:text-muted-foreground/70 focus-visible:ring-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="output" className="mt-0 h-full">
              <div className="h-full overflow-auto p-3">
                {isRunning ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Running...</span>
                  </div>
                ) : executionResult ? (
                  <div className="space-y-2">
                    {executionResult.stdout && (
                      <div>
                        <pre className="text-[#e6edf3] whitespace-pre-wrap break-words">
                          {executionResult.stdout}
                        </pre>
                      </div>
                    )}
                    
                    {executionResult.compileOutput && (
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-[10px] text-yellow-500">
                          <AlertCircle className="w-3 h-3" />
                          Compiler Output
                        </div>
                        <pre className="text-yellow-400 whitespace-pre-wrap break-words">
                          {executionResult.compileOutput}
                        </pre>
                      </div>
                    )}
                    
                    {executionResult.stderr && (
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-[10px] text-red-500">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </div>
                        <pre className="text-red-400 whitespace-pre-wrap break-words">
                          {executionResult.stderr}
                        </pre>
                      </div>
                    )}

                    {!executionResult.stdout && !executionResult.stderr && !executionResult.compileOutput && (
                      <span className="text-muted-foreground italic">No output</span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <Terminal className="mb-2 h-6 w-6 opacity-50" />
                    <span className="text-xs">Open the Input tab, type your stdin, then click Run.</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}

export function CodeEditor() {
  const {
    currentSession,
    code,
    language,
    remoteCodeSyncVersion,
    setCode,
    setLanguage,
    stdin,
    closeEditor,
    minimizeEditor,
    toggleEditorFocus,
    editorFocused,
    isRunning,
    setIsRunning,
    setExecutionResult,
  } = useMentorshipStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const currentSessionId = currentSession?.id;
  const codeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRemoteCodeRef = useRef<string | null>(null);

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

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // Define a Monaco theme aligned with GitHub dark.
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
        'editor.inactiveSelectionBackground': '#1f2a38',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionHighlightBackground': '#1f6feb24',
        'editorIndentGuide.background': '#21262d',
        'editorIndentGuide.activeBackground': '#30363d',
        'editorWhitespace.foreground': '#30363d',
        'editorBracketMatch.background': '#1f6feb24',
        'editorBracketMatch.border': '#58a6ff',
        'minimap.background': '#0d1117',
        'minimap.selectionHighlight': '#264f78',
        'scrollbarSlider.background': '#484f5833',
        'scrollbarSlider.hoverBackground': '#6e768155',
        'scrollbarSlider.activeBackground': '#8b949e77',
      },
    });

    registerEditorSnippets(monaco);
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    queueCodeSync(code, newLanguage);
  }, [code, queueCodeSync, setLanguage]);

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

  const copyCode = useCallback(() => {
    if (editorRef.current) {
      const codeValue = editorRef.current.getValue();
      navigator.clipboard.writeText(codeValue);
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
      const ext = extensions[language] || 'txt';
      const blob = new Blob([codeValue], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solution.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [language]);

  const resetCode = useCallback(() => {
    const nextCode = getDefaultCode(language);
    setCode(nextCode);
    queueCodeSync(nextCode, language);
  }, [language, queueCodeSync, setCode]);

  const runCode = useCallback(async () => {
    if (isRunning || !editorRef.current) return;

    const codeValue = editorRef.current.getValue();
    if (!codeValue.trim()) return;

    setIsRunning(true);

    try {
      // Call the frontend API route which proxies to the backend code execution service
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: codeValue,
          language: language,
          stdin,
        }),
      });

      const result = await response.json();
      setExecutionResult(result);
    } catch (error) {
      console.error('Run code error:', error);
      setExecutionResult({
        stdout: '',
        stderr: 'Failed to execute code. Please try again.',
        compileOutput: '',
        status: 'Error',
        statusCode: 6,
        time: '0ms',
        memory: '0 KB',
      });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, language, setExecutionResult, setIsRunning, stdin]);

  // Keyboard shortcut for running code (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runCode]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded overflow-hidden">
      {/* Editor Header */}
      <div
        className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-card shrink-0 select-none"
        onDoubleClick={toggleEditorFocus}
      >
        <div className="flex items-center gap-2">
          {/* macOS-style window controls */}
          <div className="flex items-center gap-1.5">
            {/* Close - Red */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={closeEditor}
                    className="w-3 h-3 rounded-full bg-[#f85149] hover:bg-[#ff6b6b] transition-colors flex items-center justify-center group"
                  >
                    <X className="w-1.5 h-1.5 text-[#1b1610] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Close Editor</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Minimize - Yellow */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={minimizeEditor}
                    className="w-3 h-3 rounded-full bg-[#d29922] hover:bg-[#f0b429] transition-colors flex items-center justify-center group"
                  >
                    <Minus className="w-1.5 h-1.5 text-[#1b1610] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Minimize to floating window</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Expand - Green */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleEditorFocus}
                    className={cn(
                      "w-3 h-3 rounded-full transition-colors flex items-center justify-center group",
                      editorFocused ? "bg-[#3fb950]" : "bg-[#3fb950] hover:bg-[#56d364]"
                    )}
                  >
                    <Maximize2 className="w-1.5 h-1.5 text-[#1b1610] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{editorFocused ? 'Exit Focus Mode' : 'Focus Mode'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="h-3 w-px bg-border" />

          <span className="text-[10px] text-muted-foreground ml-1">
            solution.{language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Run Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={runCode}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-all",
                    "bg-[#238636] hover:bg-[#2ea043] text-white",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isRunning ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Run</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Execute code <kbd className="ml-1 px-1 py-0.5 bg-secondary rounded text-[10px]">Ctrl+Enter</kbd></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-px bg-border mx-1" />

          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-28 h-6 bg-secondary border-border text-[10px] text-foreground">
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
              title="Copy code"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={downloadCode}
              title="Download code"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={resetCode}
              title="Reset code"
            >
              <RotateCcw className="h-3 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Monaco Editor */}
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
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontLigatures: true,
            lineHeight: 20,
            padding: { top: 8, bottom: 8 },
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            renderWhitespace: 'selection',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            suggestOnTriggerCharacters: true,
            snippetSuggestions: 'top',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
              alwaysConsumeMouseWheel: false,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
          }}
        />
      </div>

      {/* Output Panel */}
      <OutputPanel />
    </div>
  );
}
