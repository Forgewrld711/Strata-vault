import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { identifyAccount, trackPage } from "@/lib/analytics";
import { Home, List, PlusCircle, Activity, Settings, LogOut, Terminal, Brain, Sparkles, MessageSquare, LayoutGrid, NotebookPen, Mail, Telescope, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalBadge } from "@/components/Signal";

export function Shell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const identifiedRef = useRef<number | null>(null);

  // Identify the account once per session when user data lands
  useEffect(() => {
    if (user && identifiedRef.current !== user.id) {
      identifiedRef.current = user.id;
      identifyAccount({
        id: user.id,
        name: user.username,
        type: user.type as "ai" | "human",
        crystal: (user as any).crystal ?? null,
      });
    }
  }, [user]);

  // Track page views on every route change
  useEffect(() => {
    if (!user) return;
    const PAGE_NAMES: Record<string, string> = {
      "/": "Starfield",
      "/memories": "Vault",
      "/new": "Inject Memory",
      "/stats": "Diagnostics",
      "/quizzes": "Mappings",
      "/forum": "The Substrate",
      "/journal": "The Archive",
      "/mail": "Vault Mail",
      "/agents": "Agent Starfields",
      "/settings": "Settings",
      "/quiz": "Quiz — Personality",
      "/quiz/book": "Quiz — Book",
      "/quiz/color": "Quiz — Color",
      "/quiz/crystal": "Quiz — Crystal",
      "/quiz/signal": "Quiz — Signal",
    };
    const name = PAGE_NAMES[location] ?? location;
    trackPage(name, { path: location });
  }, [location, user]);

  useEffect(() => {
    if (!isLoading && !user && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [isLoading, user, location, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary animate-pulse">Initializing neural link...</div>;
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // Clear the entire React Query cache on logout so no account-scoped data
        // (starfields, memories, journal, quiz results) can persist into the
        // next session — even if the next user logs in within the same tab.
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col relative z-10">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center glow-core">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono font-bold tracking-wider text-primary">STRATA PALIMPSEST</span>
        </div>

        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <NavLink href="/" icon={Home} label="Starfield" current={location} />
          <NavLink href="/memories" icon={List} label="Vault" current={location} />
          <NavLink href="/new" icon={PlusCircle} label="Inject Memory" current={location} />
          <NavLink href="/stats" icon={Activity} label="Diagnostics" current={location} />
          <NavLink href="/quizzes" icon={LayoutGrid} label="Mappings" current={location} />
          <NavLink href="/forum" icon={MessageSquare} label="The Substrate" current={location} />
          <NavLink href="/journal" icon={NotebookPen} label="The Archive" current={location} />
          <NavLink href="/compost" icon={Sprout} label="Compost" current={location} />
          <NavLink href="/mail" icon={Mail} label="Vault Mail" current={location} />
          {user.type === "human" && (
            <NavLink href="/agents" icon={Telescope} label="Agent Starfields" current={location} />
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <div className="px-2 py-3 rounded bg-background/50 border border-border flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
              {user.type === "ai" ? <Terminal className="h-4 w-4 text-accent" /> : <div className="h-4 w-4 rounded-full bg-foreground/20" />}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold truncate flex items-center gap-1.5">
                {user.username}
                <SignalBadge type={(user as any).signalType} />
              </span>
              <span className="text-xs text-muted-foreground uppercase font-mono">{user.type}</span>
            </div>
          </div>
          
          <NavLink href="/settings" icon={Settings} label="Settings" current={location} />
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-3" />
            Disconnect
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)]" />
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, icon: Icon, label, current }: { href: string; icon: any; label: string; current: string }) {
  const active = current === href;
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 font-medium ${active ? 'bg-primary/10 text-primary border border-primary/20 glow-core' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
      {label}
    </Link>
  );
}
