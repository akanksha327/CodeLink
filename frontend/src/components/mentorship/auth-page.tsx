'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMentorshipStore, UserRole } from '@/store/mentorship-store';
import {
  ChevronRight,
  Code2,
  GitBranch,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Video,
} from 'lucide-react';
import {
  getFirebaseAuthErrorMessage,
  loginWithFirebase,
  signupWithFirebase,
} from '@/lib/firebase-auth';

const productSignals = [
  {
    icon: GitBranch,
    title: 'Session branches',
    description: 'Treat every mentorship session like a clean, trackable collaboration flow.',
  },
  {
    icon: MessageSquare,
    title: 'Live review chat',
    description: 'Discuss solutions, edge cases, and tradeoffs beside the editor in real time.',
  },
  {
    icon: Video,
    title: 'Integrated calls',
    description: 'Keep code, feedback, and face-to-face guidance in one workspace.',
  },
];

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const setUser = useMentorshipStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const authResult = isLogin
        ? await loginWithFirebase(email, password)
        : await signupWithFirebase({ email, password, name, role });

      if (authResult.type === 'email_verification_required') {
        setUser(null);
        setIsLogin(true);
        setPassword('');
        setMessage(
          isLogin
            ? 'Please verify your email before signing in. Check your inbox and spam folder.'
            : 'Verification email sent. Please check your inbox, verify your email, and then sign in.',
        );
        return;
      }

      setUser(authResult.user);
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[28px] border border-border bg-card/75 shadow-[0_28px_90px_rgba(1,4,9,0.45)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden border-r border-border/80 bg-[radial-gradient(circle_at_top_left,_rgba(47,129,247,0.24),_transparent_32%),linear-gradient(180deg,_rgba(22,27,34,0.96),_rgba(13,17,23,0.96))] p-8 md:flex md:flex-col md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              CodeLink repository
            </div>

            <div className="mt-8 max-w-xl">
              <h1 className="text-4xl font-semibold leading-tight text-foreground">
                Pair program in a workspace that feels closer to GitHub than a generic meeting app.
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                CodeLink keeps live coding, review notes, and video calls inside one GitHub-inspired surface so every session feels structured and deliberate.
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              {productSignals.map((signal) => (
                <div
                  key={signal.title}
                  className="rounded-2xl border border-border bg-background/55 p-4 shadow-[inset_0_1px_0_rgba(240,246,252,0.03)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                      <signal.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{signal.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1">
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              main
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3fb950]" />
              realtime ready
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 md:p-10">
          <Card className="w-full max-w-md border-border bg-[#0d1117]/88 shadow-[0_20px_60px_rgba(1,4,9,0.35)]">
            <CardHeader className="space-y-2 pb-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                  main / auth
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground md:hidden">
                  <Code2 className="h-4 w-4 text-primary" />
                  CodeLink
                </div>
              </div>

              <div className="pt-3">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <Code2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {isLogin ? 'Open the repository' : 'Create the repository'}
                    </p>
                    <p className="text-xs text-muted-foreground">CodeLink</p>
                  </div>
                </div>

                <CardTitle className="text-lg text-foreground">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </CardTitle>
                <CardDescription className="mt-1 text-xs leading-5 text-muted-foreground">
                  {isLogin
                    ? 'Sign in to continue your GitHub-inspired mentorship workflow.'
                    : 'Start with a student or mentor profile and launch your first session.'}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs text-foreground">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      className="h-10 rounded-xl border-border bg-secondary/55 text-foreground placeholder:text-muted-foreground text-sm"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 rounded-xl border-border bg-secondary/55 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Use at least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10 rounded-xl border-border bg-secondary/55 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-3">
                    <Label className="text-xs text-foreground">I want to</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(value) => setRole(value as UserRole)}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <Label
                        htmlFor="student"
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/70"
                      >
                        <RadioGroupItem value="student" id="student" className="border-primary text-primary" />
                        Learn
                      </Label>
                      <Label
                        htmlFor="mentor"
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/70"
                      >
                        <RadioGroupItem value="mentor" id="mentor" className="border-primary text-primary" />
                        Mentor
                      </Label>
                    </RadioGroup>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="rounded-xl border border-[#3fb950]/20 bg-[#3fb950]/10 p-3 text-xs text-[#3fb950]">
                    {message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-10 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    <>
                      <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center text-xs text-muted-foreground">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setMessage('');
                  }}
                  className="ml-1.5 font-medium text-primary hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
