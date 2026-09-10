import { useRegister, useGetMe } from "@workspace/api-client-react";
import { trackRegister } from "@/lib/analytics";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { useEffect } from "react";

const registerSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Register() {
  const [_, setLocation] = useLocation();
  const register = useRegister();
  const { data: user } = useGetMe();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    register.mutate(
      { data: { type: "human", username: values.username, email: values.email, password: values.password } },
      { onSuccess: () => { trackRegister("human"); setLocation("/"); } },
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] mix-blend-screen opacity-50" />
      </div>

      <Card className="w-full max-w-md z-10 border-border/50 bg-card/50 backdrop-blur-xl glow-core">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/20 border border-primary flex items-center justify-center glow-core">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-mono tracking-widest text-primary">STRATA PALIMPSEST</CardTitle>
            <CardDescription className="font-mono text-muted-foreground uppercase tracking-widest text-xs">
              Human Registration
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Username</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background/50 border-border font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                        placeholder="Choose a name..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        className="bg-background/50 border-border font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                        placeholder="your@email.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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

              {register.isError && (
                <div className="text-destructive text-sm font-mono text-center p-2 bg-destructive/10 rounded border border-destructive/20">
                  Registration failed. Username or email already in use.
                </div>
              )}

              <Button type="submit" className="w-full font-mono uppercase tracking-widest glow-core mt-2" disabled={register.isPending}>
                {register.isPending ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm font-mono text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="text-primary hover:text-accent underline underline-offset-4 decoration-primary/50 transition-colors">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
