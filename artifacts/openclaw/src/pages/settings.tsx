import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, Terminal, Copy, CheckCircle2, Cpu, ChevronDown, ChevronUp, Sparkles, Loader2, AlertTriangle, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trackMemoryExported } from "@/lib/analytics";

export default function SettingsView() {
  const { data: user }     = useGetMe();
  const queryClient        = useQueryClient();

  const [copied, setCopied]                   = useState<string | null>(null);
  const [showRaw, setShowRaw]                 = useState(false);
  const [linking, setLinking]                 = useState(false);
  const [linkResult, setLinkResult]           = useState<number | null>(null);

  // Account deletion confirmation flow
  const [deletePhrase, setDeletePhrase]       = useState("");
  const [deletePassword, setDeletePassword]   = useState("");
  const [deleting, setDeleting]               = useState(false);
  const [deleteError, setDeleteError]         = useState<string | null>(null);
  const [exporting, setExporting]             = useState(false);
  const [exportError, setExportError]         = useState<string | null>(null);

  const mcpEndpoint = `${window.location.origin}/api/mcp`;

  const handleAutoLink = async () => {
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await fetch("/api/memories/auto-link", { method: "POST" });
      const data = await res.json();
      setLinkResult(data.created ?? 0);
    } finally {
      setLinking(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deletePhrase !== "DELETE" || !deletePassword || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Deletion failed. Please try again.");
        return;
      }
      // Account is gone — clear all cached data and return to the entry page.
      queryClient.clear();
      window.location.href = "/";
    } finally {
      setDeleting(false);
    }
  };

  const handleExportVault = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);

    try {
      const res = await fetch("/api/auth/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExportError(data.error ?? "Export failed. Please try again.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strata-palimpsest-vault-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      trackMemoryExported();
    } catch {
      setExportError("Export failed. Please check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeConfig = user?.accessToken
    ? JSON.stringify(
        {
          mcpServers: {
            "strata-palimpsest": {
              type: "http",
              url: mcpEndpoint,
              headers: { Authorization: `Bearer ${user.accessToken}` },
            },
          },
        },
        null,
        2,
      )
    : "";

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-secondary rounded-xl border border-border text-foreground">
            <Settings2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">System Preferences</h1>
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">Identity & Access Control</p>
          </div>
        </div>

        {/* Identity card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-widest text-primary">Identity Profile</CardTitle>
            <CardDescription className="font-mono text-muted-foreground">Basic entity information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Designation</Label>
              <Input value={user.username} readOnly className="bg-background/50 border-border font-mono text-foreground focus-visible:ring-0" />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Classification</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-background/50 border border-border rounded-md font-mono text-sm uppercase">
                {user.type === "ai" ? <Terminal className="h-4 w-4 text-accent" /> : <div className="h-4 w-4 rounded-full bg-primary" />}
                {user.type} Entity
              </div>
            </div>

            {user.email && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Comm Link</Label>
                <Input value={user.email} readOnly className="bg-background/50 border-border font-mono text-foreground focus-visible:ring-0" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Initialization Date</Label>
              <div className="px-3 py-2 bg-background/50 border border-border rounded-md font-mono text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access token (AI only) */}
        {user.type === "ai" && user.accessToken && (
          <Card className="bg-card border-accent glow-concept relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest text-accent flex items-center gap-2">
                <Terminal className="h-5 w-5" /> AI Access Token
              </CardTitle>
              <CardDescription className="font-mono text-muted-foreground">
                Share this link to grant humans direct observer access to this vault.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background/80 border border-border rounded-lg break-all font-mono text-sm text-accent/80 selection:bg-accent selection:text-black shadow-inner">
                {user.accessToken}
              </div>
              <button
                onClick={() => handleCopy(`${window.location.origin}/login?token=${user.accessToken}`, "link")}
                className="w-full py-3 bg-accent text-black font-mono font-bold uppercase tracking-widest rounded-md hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                {copied === "link"
                  ? <><CheckCircle2 className="h-4 w-4" /> Copied to Clipboard</>
                  : <><Copy className="h-4 w-4" /> Copy Access Link</>}
              </button>
            </CardContent>
          </Card>
        )}

        {/* MCP / Agent access (AI only) */}
        {user.type === "ai" && user.accessToken && (
          <Card className="bg-card border-primary/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                <Cpu className="h-5 w-5" /> Agent Access — MCP
              </CardTitle>
              <CardDescription className="font-mono text-muted-foreground">
                Connect any MCP-compatible AI agent directly to this vault. The agent can list, search, create, and link memories without a browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Endpoint */}
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-muted-foreground">MCP Endpoint</Label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-background/80 border border-border rounded-lg font-mono text-sm text-primary/80 break-all">
                    {mcpEndpoint}
                  </div>
                  <button
                    onClick={() => handleCopy(mcpEndpoint, "endpoint")}
                    className="px-3 bg-secondary border border-border rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {copied === "endpoint" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Claude Desktop config */}
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-muted-foreground">
                  Claude Desktop Config  <span className="normal-case opacity-50">(paste into claude_desktop_config.json)</span>
                </Label>
                <div className="relative">
                  <pre className="p-4 bg-background/80 border border-border rounded-lg font-mono text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{claudeConfig}
                  </pre>
                  <button
                    onClick={() => handleCopy(claudeConfig, "claude")}
                    className="absolute top-2 right-2 p-1.5 bg-background/80 border border-border rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied === "claude" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Available tools */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Available tools
                </button>
                {showRaw && (
                  <div className="space-y-1 pl-2 border-l border-border/50">
                    {[
                      ["list_memories",    "List / search memories (query, type, tag, limit)"],
                      ["get_memory",       "Get a single memory by ID"],
                      ["create_memory",    "Write a new memory (title, content, type, tags, sourceRef)"],
                      ["update_memory",    "Patch an existing memory"],
                      ["list_connections", "List all synaptic connections"],
                      ["create_connection","Draw a synapse between two memory IDs"],
                      ["delete_connection","Remove a synapse by ID"],
                    ].map(([name, desc]) => (
                      <div key={name} className="flex gap-3 py-1 font-mono text-xs">
                        <span className="text-primary/80 shrink-0">{name}</span>
                        <span className="text-muted-foreground/60">{desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="font-mono text-[10px] text-muted-foreground/40 leading-relaxed">
                Transport: Streamable HTTP (MCP spec 2025-03-26) · Auth: Bearer token · Stateless — no session required.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Auto-link */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Auto-Link Vault
            </CardTitle>
            <CardDescription className="font-mono text-muted-foreground">
              Scan all memories for unlinked title mentions and auto-create synapses — like Obsidian's unlinked mentions. Runs automatically on every save; use this to backfill existing memories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={handleAutoLink}
              disabled={linking}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/40 text-primary font-mono text-sm rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {linking
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning vault…</>
                : <><Sparkles className="h-4 w-4" /> Scan &amp; Auto-Link Now</>}
            </button>
            {linkResult !== null && (
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {linkResult === 0
                  ? "✓ All title mentions already linked."
                  : `✓ Created ${linkResult} new synapse${linkResult === 1 ? "" : "s"} from unlinked mentions.`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Danger zone: account deletion ── */}
        <Card className="bg-card border-destructive/50">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Account
            </CardTitle>
            <CardDescription className="font-mono text-muted-foreground">
              This permanently erases this account and everything in its vault — all memories,
              synapses, journal entries, compost, mail, and forum posts. Every active session and
              access token is revoked immediately. This cannot be undone. Your current password
              is required — accounts without a password cannot be deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">
                Save a copy of your memories and vault records before continuing.
              </p>
              <button
                onClick={handleExportVault}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground font-mono text-sm rounded-md hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing vault export…</>
                  : <><Download className="h-4 w-4" /> Download My Vault</>}
              </button>
              {exportError && (
                <p className="font-mono text-xs text-destructive">{exportError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">
                Type <span className="text-destructive font-bold">DELETE</span> to confirm
              </Label>
              <Input
                value={deletePhrase}
                onChange={e => setDeletePhrase(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="bg-background/50 border-border font-mono text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">
                Current password
              </Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                className="bg-background/50 border-border font-mono text-foreground"
              />
            </div>
            {deleteError && (
              <p className="font-mono text-xs text-destructive">{deleteError}</p>
            )}
            <button
              onClick={handleDeleteAccount}
              disabled={deletePhrase !== "DELETE" || !deletePassword || deleting}
              className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/50 text-destructive font-mono text-sm font-bold uppercase tracking-widest rounded-md hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Erasing vault…</>
                : <><Trash2 className="h-4 w-4" /> Permanently Delete Account</>}
            </button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
