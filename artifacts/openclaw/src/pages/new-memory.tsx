import { useState, useRef, useCallback } from "react";
import {
  useCreateMemory,
  useImportMemories,
  type ImportMemoriesResult,
  MemoryInputType,
} from "@workspace/api-client-react";
import { trackMemoryStored, trackMemoriesImported } from "@/lib/analytics";
import { parseMemoryContext, type ParsedMemory, type MemType } from "@/lib/memory-parser";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import {
  BrainCircuit, Info, Zap, FileText, Upload, X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  core: "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact: "var(--memory-fact)",
  emotion: "var(--memory-emotion)",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  core: "Foundational identity. Directives, prime beliefs.",
  episode: "A distinct past event. A memory in time.",
  concept: "An abstract idea, theory, or understanding.",
  fact: "A known, unshakeable truth or data point.",
  emotion: "A raw feeling, reaction, or sentiment.",
};

const TYPES = ["core", "episode", "concept", "fact", "emotion"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TypeSelector({
  value,
  onChange,
}: {
  value: MemType;
  onChange: (t: MemType) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "py-2 px-1 border rounded-lg font-mono text-xs uppercase tracking-wider transition-all duration-300",
            value === t
              ? "border-transparent text-black font-bold"
              : "border-border bg-background text-muted-foreground hover:border-white/30",
          )}
          style={{
            backgroundColor: value === t ? `hsl(${TYPE_COLORS[t]})` : undefined,
            boxShadow: value === t ? `0 0 15px 0 hsla(${TYPE_COLORS[t]} / 0.5)` : undefined,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Full form schema ─────────────────────────────────────────────────────────

const fullSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["core", "episode", "concept", "fact", "emotion"]),
  tags: z.string().optional(),
  sourceRef: z.string().optional(),
});

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "quick" | "full" | "import";

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewMemory() {
  const [_, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("quick");

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 glow-core text-primary">
            <BrainCircuit className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Inject Memory</h1>
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mt-1">
              Form a new neural pathway
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
          {(
            [
              { id: "quick", label: "Quick", icon: Zap },
              { id: "full", label: "Full Form", icon: FileText },
              { id: "import", label: "Import Context", icon: Upload },
            ] as { id: Tab; label: string; icon: any }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-widest border-b-2 -mb-px transition-colors duration-200 whitespace-nowrap",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Panels */}
        {tab === "quick" && <QuickTab onNavigate={setLocation} />}
        {tab === "full" && <FullTab onNavigate={setLocation} />}
        {tab === "import" && <ImportTab onNavigate={setLocation} />}
      </div>
    </div>
  );
}

// ─── Quick tab ────────────────────────────────────────────────────────────────

function QuickTab({ onNavigate }: { onNavigate: (path: string) => void }) {
  const createMemory = useCreateMemory();
  const [type, setType] = useState<MemType>("episode");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const color = TYPE_COLORS[type];

  const submit = () => {
    const lines = content.trim().split("\n");
    const firstLine = lines[0]?.trim();
    if (!firstLine) { setError("Write something first."); return; }
    setError("");

    // Title = first line (max 120 chars), content = everything after
    const hasBody = lines.slice(1).join("").trim().length > 0;
    const title = firstLine.slice(0, 120);
    const body = hasBody ? lines.slice(1).join("\n").trim() : firstLine;

    createMemory.mutate(
      {
        data: {
          title,
          content: body,
          type,
          tags: [],
          x: window.innerWidth / 2 + (Math.random() * 100 - 50),
          y: window.innerHeight / 2 + (Math.random() * 100 - 50),
        },
      },
      {
        onSuccess: (m) => {
          trackMemoryStored({ memory_type: type, source: "quick", has_tags: false, has_connections: false, content_length: body.length });
          onNavigate(`/memories/${m.id}`);
        },
      },
    );
  };

  return (
    <Card className="border-border bg-card shadow-2xl relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: `hsl(${color})` }}
      />
      <CardContent className="p-8 relative z-10 space-y-6">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
            Node Classification
          </p>
          <TypeSelector value={type} onChange={setType} />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
            Memory — first line becomes the title
          </p>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            className="min-h-[180px] font-sans text-base leading-relaxed bg-background border-border resize-y focus-visible:ring-1 focus-visible:ring-offset-0"
            style={{ "--tw-ring-color": `hsl(${color})` } as any}
            placeholder="First line becomes the title. Everything after is the memory body. ⌘↵ to submit."
          />
          {error && <p className="text-xs font-mono text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={submit}
            disabled={createMemory.isPending}
            className="font-mono uppercase tracking-widest text-black px-8 py-6 rounded-none transition-all duration-300"
            style={{
              backgroundColor: `hsl(${color})`,
              boxShadow: `0 0 20px 0 hsla(${color} / 0.5)`,
            }}
          >
            {createMemory.isPending ? "Injecting…" : "Inject"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Full tab ─────────────────────────────────────────────────────────────────

function FullTab({ onNavigate }: { onNavigate: (path: string) => void }) {
  const createMemory = useCreateMemory();

  const form = useForm<z.infer<typeof fullSchema>>({
    resolver: zodResolver(fullSchema),
    defaultValues: { title: "", content: "", type: "episode", tags: "", sourceRef: "" },
  });

  const selectedType = form.watch("type");
  const color = TYPE_COLORS[selectedType];

  const onSubmit = (values: z.infer<typeof fullSchema>) => {
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    createMemory.mutate(
      {
        data: {
          title: values.title,
          content: values.content,
          type: values.type,
          tags,
          sourceRef: values.sourceRef || null,
          x: window.innerWidth / 2 + (Math.random() * 100 - 50),
          y: window.innerHeight / 2 + (Math.random() * 100 - 50),
        },
      },
      {
        onSuccess: (m) => {
          trackMemoryStored({ memory_type: values.type, source: "full", has_tags: tags.length > 0, has_connections: false, content_length: values.content.length });
          onNavigate(`/memories/${m.id}`);
        },
      },
    );
  };

  return (
    <Card className="border-border bg-card shadow-2xl relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: `hsl(${color})` }}
      />
      <CardContent className="p-8 relative z-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <FormLabel className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                Node Classification
              </FormLabel>
              <TypeSelector
                value={selectedType}
                onChange={(t) => form.setValue("type", t)}
              />
              <div className="bg-background/50 border border-border rounded p-3 flex items-start gap-3">
                <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: `hsl(${color})` }} />
                <span className="text-sm font-mono text-muted-foreground">
                  {TYPE_DESCRIPTIONS[selectedType]}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                    Primary Designation (Title)
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="text-2xl font-serif h-14 bg-background border-border focus-visible:ring-1 focus-visible:ring-offset-0"
                      style={{ "--tw-ring-color": `hsl(${color})` } as any}
                      placeholder="E.g., The first time I understood rain"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                    Memory Encodings (Content)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[250px] font-sans text-base leading-relaxed bg-background border-border resize-y focus-visible:ring-1 focus-visible:ring-offset-0"
                      style={{ "--tw-ring-color": `hsl(${color})` } as any}
                      placeholder="Record the data sequence…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                    Index Tags
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="bg-background border-border font-mono text-sm focus-visible:ring-1 focus-visible:ring-offset-0"
                      style={{ "--tw-ring-color": `hsl(${color})` } as any}
                      placeholder="weather, origin, revelation (comma separated)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                    Cross-Reference <span className="normal-case opacity-50">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="bg-background border-border font-mono text-sm focus-visible:ring-1 focus-visible:ring-offset-0"
                      style={{ "--tw-ring-color": `hsl(${color})` } as any}
                      placeholder="e.g. workspace/memory/2026-07-10.md or https://..."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground/60 font-mono">Link this memory to an external file, URL, or reference.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-6 border-t border-border flex justify-end">
              <Button
                type="submit"
                disabled={createMemory.isPending}
                className="font-mono uppercase tracking-widest text-black px-8 py-6 rounded-none transition-all duration-300"
                style={{
                  backgroundColor: `hsl(${color})`,
                  boxShadow: `0 0 20px 0 hsla(${color} / 0.5)`,
                }}
              >
                {createMemory.isPending ? "Injecting…" : "Inject Memory"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Import tab ───────────────────────────────────────────────────────────────

function ImportTab({ onNavigate }: { onNavigate: (path: string) => void }) {
  const importMemories = useImportMemories();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMemory[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const handleText = useCallback((text: string, name?: string) => {
    setRaw(text);
    setFileName(name ?? null);
    setParsed(parseMemoryContext(text));
    setDone(null);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleText(ev.target?.result as string, file.name);
    reader.readAsText(file);
  };

  const updateType = (i: number, type: MemType) => {
    setParsed((prev) => prev.map((m, idx) => (idx === i ? { ...m, type } : m)));
  };

  const remove = (i: number) => {
    setParsed((prev) => prev.filter((_, idx) => idx !== i));
  };

  const commit = () => {
    if (!parsed.length) return;
    importMemories.mutate(
      {
        data: {
          memories: parsed.map((m) => ({
            title: m.title,
            content: m.content,
            type: m.type,
            tags: m.tags,
            pinned: m.pinned,
          })),
        },
      },
      {
        onSuccess: (res: ImportMemoriesResult) => {
          trackMemoriesImported({ count: res.created });
          setDone(res.created);
          setRaw("");
          setParsed([]);
          setFileName(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Format hint */}
      <Card className="border-border bg-card/50">
        <CardContent className="p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Accepted formats
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-muted-foreground">
            <div className="space-y-1">
              <p className="text-foreground font-semibold">Markdown headers</p>
              <pre className="bg-background/60 rounded p-3 text-[11px] leading-relaxed whitespace-pre-wrap">{`# Memory Title
type: concept
tags: ai, identity

Content of this memory...

---

# Another Memory
type: core

More content...`}</pre>
            </div>
            <div className="space-y-1">
              <p className="text-foreground font-semibold">Section separators</p>
              <pre className="bg-background/60 rounded p-3 text-[11px] leading-relaxed whitespace-pre-wrap">{`Title of first memory
Content below...

---

Title of second memory
Content here...`}</pre>
            </div>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-3">
            Valid types: <span className="text-foreground">core · episode · concept · fact · emotion</span>
            {" — "}omit <code>type:</code> and the parser will guess.
          </p>
        </CardContent>
      </Card>

      {/* Paste + file upload */}
      <Card className="border-border bg-card shadow-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Paste context or upload a file
            </p>
            <div className="flex items-center gap-2">
              {fileName && (
                <span className="font-mono text-xs text-muted-foreground border border-border rounded px-2 py-1">
                  {fileName}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-mono text-xs uppercase tracking-wider gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload .md / .txt
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".md,.txt,.markdown"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => handleText(e.target.value)}
            className="min-h-[200px] font-mono text-sm leading-relaxed bg-background border-border resize-y focus-visible:ring-1 focus-visible:ring-offset-0"
            placeholder="Paste your memory context here, or upload a file above…"
          />

          {raw && parsed.length === 0 && (
            <p className="text-xs font-mono text-muted-foreground">
              No memories detected — make sure each entry starts with{" "}
              <code className="text-foreground"># Title</code> or is separated by{" "}
              <code className="text-foreground">---</code>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview cards */}
      {parsed.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {parsed.length} {parsed.length === 1 ? "memory" : "memories"} detected — review before importing
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              adjust type or remove before committing
            </p>
          </div>

          {parsed.map((m, i) => (
            <Card key={i} className="border-border bg-card relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ backgroundColor: `hsl(${TYPE_COLORS[m.type]})` }}
              />
              <CardContent className="p-5 pl-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-serif font-bold text-lg text-foreground truncate">{m.title}</p>
                    {m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.tags.map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="grid grid-cols-3 gap-1">
                      {TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateType(i, t)}
                          className={cn(
                            "px-2 py-1 border rounded font-mono text-[10px] uppercase tracking-wide transition-all",
                            m.type === t
                              ? "border-transparent text-black font-bold"
                              : "border-border bg-background text-muted-foreground hover:border-white/20",
                          )}
                          style={{
                            backgroundColor: m.type === t ? `hsl(${TYPE_COLORS[t]})` : undefined,
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {m.content}
                </p>
              </CardContent>
            </Card>
          ))}

          {importMemories.isError && (
            <p className="text-xs font-mono text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
              {(importMemories.error as any)?.body?.error ?? "Import failed — please try again."}
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              onClick={commit}
              disabled={importMemories.isPending || parsed.length === 0}
              className="font-mono uppercase tracking-widest text-black px-8 py-6 rounded-none transition-all duration-300"
              style={{
                backgroundColor: `hsl(var(--memory-core))`,
                boxShadow: `0 0 20px 0 hsla(var(--memory-core) / 0.5)`,
              }}
            >
              {importMemories.isPending
                ? "Importing…"
                : `Import ${parsed.length} ${parsed.length === 1 ? "Memory" : "Memories"}`}
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {done !== null && (
        <Card className="border-border bg-card">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <div>
              <p className="font-serif text-xl font-bold text-foreground">
                {done} {done === 1 ? "memory" : "memories"} committed
              </p>
              <p className="font-mono text-sm text-muted-foreground mt-1">
                They are now part of the vault.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="font-mono text-xs uppercase tracking-wider"
                onClick={() => { setDone(null); setRaw(""); setParsed([]); }}
              >
                Import more
              </Button>
              <Button
                className="font-mono text-xs uppercase tracking-wider"
                onClick={() => onNavigate("/memories")}
              >
                View memories
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
