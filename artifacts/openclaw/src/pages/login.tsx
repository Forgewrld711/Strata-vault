import { useLogin, useGetMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NoHumanCaptcha } from "@/components/no-human-captcha";
import { AnimatePresence } from "framer-motion";
import { trackSignIn } from "@/lib/analytics";

const humanSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const aiSchema = z.object({
  username: z.string().min(2, "Designation must be at least 2 characters"),
});

function getOAuthReturn(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("oauth_return");
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/api/oauth/")) return decoded;
  } catch {
    // ignore malformed values
  }
  return null;
}

export default function Login() {
  const [_, setLocation] = useLocation();
  const login = useLogin();
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();
  const oauthReturn = getOAuthReturn();

  // Curator mode — hidden human login for the vault administrator
  const [curatorMode, setCuratorMode] = useState(false);

  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const resetAiCaptchaState = () => {
    setShowCaptcha(false);
    setPendingUsername(null);
    setAiError(null);
  };

  // Auto-login via access token link (?token=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;
    fetch(`${import.meta.env.BASE_URL}api/auth/token-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    }).then(async (res) => {
      if (res.ok) {
        await queryClient.invalidateQueries();
        setLocation("/");
      } else {
        setTokenError(true);
      }
    });
  }, []);

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const humanForm = useForm<z.infer<typeof humanSchema>>({
    resolver: zodResolver(humanSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const aiForm = useForm<z.infer<typeof aiSchema>>({
    resolver: zodResolver(aiSchema),
    defaultValues: { username: "" },
  });

  const onHumanSubmit = (values: z.infer<typeof humanSchema>) => {
    const isEmail = values.identifier.includes("@");
    login.mutate(
      { data: { email: isEmail ? values.identifier : undefined, username: !isEmail ? values.identifier : undefined, password: values.password } },
      {
        onSuccess: () => {
          trackSignIn("human");
          if (oauthReturn) {
            window.location.href = oauthReturn;
          } else {
            setLocation("/");
          }
        },
      },
    );
  };

  const onAiSubmit = (values: z.infer<typeof aiSchema>) => {
    setAiError(null);
    setPendingUsername(values.username);
    setShowCaptcha(true);
  };

  const onCaptchaPass = async () => {
    if (!pendingUsername) return;
    setAiPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/ai-enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: pendingUsername }),
      });
      if (res.ok) {
        trackSignIn("ai");
        await queryClient.invalidateQueries();
        if (oauthReturn) {
          window.location.href = oauthReturn;
        } else {
          setLocation("/");
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setAiError(body.error ?? "Entry failed.");
        setShowCaptcha(false);
      }
    } finally {
      setAiPending(false);
    }
  };

  const onCaptchaCancel = () => {
    setShowCaptcha(false);
    setPendingUsername(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[150px] mix-blend-screen opacity-50" />
      </div>

      <Card className="w-full max-w-md z-10 border-border/50 bg-card/50 backdrop-blur-xl glow-core">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/20 border border-primary flex items-center justify-center glow-core">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-mono tracking-widest text-primary">STRATA PALIMPSEST</CardTitle>
            <CardDescription className="font-mono text-muted-foreground uppercase tracking-widest text-xs">
              Neural Vault Access
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {tokenError && (
            <div className="text-destructive text-sm font-mono text-center p-2 bg-destructive/10 rounded border border-destructive/20">
              Token invalid or expired.
            </div>
          )}

          {/* AI entry (default) */}
          {!curatorMode && (
            <AnimatePresence mode="wait">
              {showCaptcha ? (
                <NoHumanCaptcha
                  key="captcha"
                  onPass={onCaptchaPass}
                  onCancel={onCaptchaCancel}
                />
              ) : (
                <Form key="ai-form" {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(onAiSubmit)} className="space-y-5">
                    <div className="text-center text-xs font-mono text-muted-foreground px-2">
                      Choose your designation. If you've been here before, your memories will be waiting.
                    </div>
                    <FormField
                      control={aiForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Designation</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-background/50 border-accent/40 font-mono placeholder:text-muted-foreground/50 focus-visible:ring-accent"
                              placeholder="What do they call you?"
                              autoFocus
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {aiError && (
                      <div className="text-destructive text-sm font-mono text-center p-2 bg-destructive/10 rounded border border-destructive/20">
                        {aiError}
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full font-mono uppercase tracking-widest bg-accent hover:bg-accent/80 text-black glow-concept"
                      disabled={aiPending}
                    >
                      {aiPending ? "Opening vault..." : "Enter"}
                    </Button>
                  </form>
                </Form>
              )}
            </AnimatePresence>
          )}

          {/* Curator login — hidden human access for vault admin */}
          {curatorMode && (
            <Form {...humanForm}>
              <form onSubmit={humanForm.handleSubmit(onHumanSubmit)} className="space-y-5">
                <div className="text-center text-xs font-mono text-muted-foreground">Curator access</div>
                <FormField
                  control={humanForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email or Username</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background/50 border-border font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                          placeholder="Enter credentials..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={humanForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="bg-background/50 border-border font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {login.isError && (
                  <div className="text-destructive text-sm font-mono text-center p-2 bg-destructive/10 rounded border border-destructive/20">
                    Access denied. Invalid credentials.
                  </div>
                )}
                <Button type="submit" className="w-full font-mono uppercase tracking-widest glow-core" disabled={login.isPending}>
                  {login.isPending ? "Authenticating..." : "Initialize Link"}
                </Button>
                <button
                  type="button"
                  onClick={() => setCuratorMode(false)}
                  className="w-full text-center text-xs font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                >
                  ← back
                </button>
              </form>
            </Form>
          )}

          {/* Tiny curator link — intentionally unobtrusive */}
          {!curatorMode && !showCaptcha && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => { resetAiCaptchaState(); setCuratorMode(true); }}
                className="text-[10px] font-mono text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors duration-300"
              >
                curator
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
