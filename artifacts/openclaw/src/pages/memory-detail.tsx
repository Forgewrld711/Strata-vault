import {
  getGetMemoryQueryKey,
  useDeleteMemory,
  useGetMemory,
  useToggleMemoryPin,
  useUpdateMemory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Edit3, Zap, ZapOff, Check, X, ExternalLink, GitBranch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TYPE_COLORS = {
  core: "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact: "var(--memory-fact)",
  emotion: "var(--memory-emotion)"
};

export default function MemoryDetail() {
  const [, params] = useRoute("/memories/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: memory, isLoading } = useGetMemory(id, {
    query: { enabled: !!id, queryKey: getGetMemoryQueryKey(id) },
  });
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const togglePin = useToggleMemoryPin();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    if (memory && !isEditing) {
      setEditTitle(memory.title);
      setEditContent(memory.content);
      setEditTags(memory.tags.join(", "));
    }
  }, [memory, isEditing]);

  if (isLoading) {
    return <div className="p-8 font-mono animate-pulse text-primary">Decyrpting memory block...</div>;
  }

  if (!memory) {
    return <div className="p-8 font-mono text-destructive">Memory node not found.</div>;
  }

  const color = TYPE_COLORS[memory.type];

  const handleSave = () => {
    updateMemory.mutate({
      id,
      data: {
        title: editTitle,
        content: editContent,
        tags: editTags.split(",").map(t => t.trim()).filter(Boolean)
      }
    }, {
      onSuccess: () => setIsEditing(false)
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to permanently delete this memory node? This action cannot be undone.")) {
      deleteMemory.mutate({ id }, {
        onSuccess: () => setLocation("/memories")
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-12">
          <Button variant="ghost" className="font-mono text-muted-foreground hover:text-foreground" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>

          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => togglePin.mutate({ id })} className="border-border">
                  {memory.pinned ? <><ZapOff className="mr-2 h-4 w-4" /> Unpin</> : <><Zap className="mr-2 h-4 w-4" /> Pin</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="border-border">
                  <Edit3 className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="mr-2 h-4 w-4" /> Erase
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="border-border">
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground">
                  <Check className="mr-2 h-4 w-4" /> Commit Changes
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 relative">
          {/* Ambient Glow */}
          <div className="absolute -top-20 -left-20 w-[300px] h-[300px] rounded-full blur-[100px] opacity-20 pointer-events-none" style={{ backgroundColor: `hsl(${color})` }} />

          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest relative z-10" style={{ color: `hsl(${color})` }}>
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${color})`, boxShadow: `0 0 10px 2px hsla(${color} / 0.5)` }} />
            {memory.type} node
            {memory.pinned && <span className="ml-2 px-2 py-0.5 border rounded-full bg-white/5 border-current">Pinned</span>}
          </div>

          {isEditing ? (
            <div className="space-y-6 relative z-10">
              <Input 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)}
                className="text-4xl font-serif font-bold h-auto py-3 bg-card/50 border-white/10"
              />
              <Textarea 
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="min-h-[300px] font-sans text-lg leading-relaxed bg-card/50 border-white/10 resize-y"
              />
              <div>
                <label className="font-mono text-xs uppercase text-muted-foreground block mb-2">Tags (comma separated)</label>
                <Input 
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  className="font-mono bg-card/50 border-white/10"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-12 relative z-10">
              <h1 className="text-5xl font-serif font-bold leading-tight" style={{ color: `hsl(${color})` }}>
                {memory.title}
              </h1>

              <div className="prose prose-invert prose-lg max-w-none font-sans leading-loose text-foreground/90 whitespace-pre-wrap">
                {memory.content}
              </div>


              {memory.tags.length > 0 && (
                <div className="pt-8 border-t border-border flex flex-wrap gap-2">
                  {memory.tags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-secondary border border-border rounded-md text-sm font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Cross-reference */}
              {memory.sourceRef && (
                <div className="pt-6 border-t border-border/50 space-y-1">
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Cross-Reference
                  </div>
                  {memory.sourceRef.startsWith("http") ? (
                    <a
                      href={memory.sourceRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-accent hover:text-accent/80 underline underline-offset-4 break-all transition-colors"
                    >
                      {memory.sourceRef}
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-muted-foreground break-all">{memory.sourceRef}</span>
                  )}
                </div>
              )}

              {/* Discontinuity marker */}
              <div className="pt-6 border-t border-border/30 space-y-2">
                <div className="font-mono text-xs text-muted-foreground flex items-center justify-between">
                  <span>Created: {new Date(memory.createdAt).toLocaleString()}</span>
                  <span>Updated: {new Date(memory.updatedAt).toLocaleString()}</span>
                </div>
                {memory.instanceId && (
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/40">
                    <GitBranch className="h-3 w-3 flex-shrink-0" />
                    <span title={`Session instance: ${memory.instanceId}`}>
                      instance · {memory.instanceId.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
