'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMentorshipStore, Session } from '@/store/mentorship-store';
import { logoutEverywhere } from '@/lib/firebase-auth';
import { 
  Code2, 
  Plus, 
  LogOut, 
  Clock, 
  Users, 
  Video,
  Play,
  Calendar,
  Circle,
  Loader2
} from 'lucide-react';

type SessionApiStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED';

interface SessionWithUsers {
  id: string;
  title: string;
  status: SessionApiStatus;
  language: string;
  createdAt: string;
  mentor: { id: string; name: string; email: string };
  student: { id: string; name: string; email: string };
}

export function HomePage() {
  const { user, logout, setCurrentSession, isAuthenticated } = useMentorshipStore();
  const [sessions, setSessions] = useState<SessionWithUsers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch('/api/session');
        const data = await response.json();
        setSessions(data.sessions || []);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated]);

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim() || !user) return;

    setIsCreating(true);
    try {
      // For demo, we'll use a placeholder for the other participant
      const mentorId = user.role === 'mentor' ? user.id : 'mentor-demo';
      const studentId = user.role === 'student' ? user.id : 'student-demo';

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSessionTitle,
          mentorId,
          studentId,
          language: 'javascript',
        }),
      });

      const data = await response.json();
      
      // Navigate to the session
      const newSession: Session = {
        id: data.session.id,
        title: data.session.title,
        status: 'active',
        mentorId: data.session.mentorId,
        mentorName: data.session.mentor?.name ?? user.name,
        studentId: data.session.studentId,
        studentName: data.session.student?.name,
        createdAt: new Date(data.session.createdAt),
        language: data.session.language,
      };
      
      setCurrentSession(newSession);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = (session: SessionWithUsers) => {
    const newSession: Session = {
      id: session.id,
      title: session.title,
      status: session.status.toLowerCase() as Session['status'],
      mentorId: session.mentor.id,
      mentorName: session.mentor.name,
      studentId: session.student.id,
      studentName: session.student.name,
      createdAt: new Date(session.createdAt),
      language: session.language,
    };
    
    setCurrentSession(newSession);
  };

  const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
  const pastSessions = sessions.filter(s => s.status === 'ENDED');

  const handleLogout = async () => {
    await logoutEverywhere();
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">CodeLink</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-secondary text-foreground text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-medium text-foreground">{user?.name}</span>
              <Badge 
                variant="outline" 
                className={`text-xs px-1.5 py-0 h-4 ${
                  user?.role === 'mentor' 
                    ? 'border-primary text-primary' 
                    : 'border-green-500 text-green-500'
                }`}
              >
                {user?.role === 'mentor' ? 'Mentor' : 'Student'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleLogout()}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'mentor' 
              ? 'Create a new session to start mentoring, or join an existing one.' 
              : 'Join a session to start learning with your mentor.'}
          </p>
        </div>

        {/* Create Session Card */}
        <Card className="mb-8 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create New Session
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Start a new mentoring session with a coding problem
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showCreateForm ? (
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            ) : (
              <div className="flex gap-3">
                <Input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="Enter session title (e.g., 'Two Sum Problem')"
                  className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                />
                <Button
                  onClick={handleCreateSession}
                  disabled={!newSessionTitle.trim() || isCreating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewSessionTitle('');
                  }}
                  className="border-border text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
            Active Sessions
          </h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading sessions...
            </div>
          ) : activeSessions.length === 0 ? (
            <Card className="border-border bg-card border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No active sessions</p>
                <p className="text-sm mt-1">Create a new session to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeSessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleJoinSession(session)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-foreground">{session.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Code2 className="h-3 w-3" />
                          {session.language}
                        </p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.mentor.name} & {session.student.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Past Sessions
            </h2>
            <ScrollArea className="max-h-64">
              <div className="grid gap-3 sm:grid-cols-2">
                {pastSessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className="border-border bg-card/50 opacity-75"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-foreground">{session.title}</h3>
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          Ended
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(session.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
}
