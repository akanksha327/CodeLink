'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMentorshipStore } from '@/store/mentorship-store';
import { Code2, LogOut, PanelLeftClose, PanelLeft, Keyboard } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { logoutEverywhere } from '@/lib/firebase-auth';

export function TopNav() {
  const { user, currentSession, logout, leftPanelCollapsed, toggleLeftPanel } = useMentorshipStore();

  const handleLogout = async () => {
    await logoutEverywhere();
    logout();
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLeftPanel}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                {leftPanelCollapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Toggle sidebar <kbd className="ml-1 px-1 py-0.5 bg-[#30363d] rounded text-[#8b949e]">⌘B</kbd></p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <span className="text-base sm:text-lg font-semibold text-foreground hidden sm:block">CodeLink</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {currentSession && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border">
            <span className="text-xs text-muted-foreground">Session:</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {currentSession.title}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user && (
          <>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-secondary text-foreground text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-foreground leading-tight">{user.name}</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1.5 py-0 h-4 leading-none ${
                    user.role === 'mentor' 
                      ? 'border-primary text-primary' 
                      : 'border-green-500 text-green-500'
                  }`}
                >
                  {user.role === 'mentor' ? 'Mentor' : 'Student'}
                </Badge>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleLogout()}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Logout</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </header>
  );
}
