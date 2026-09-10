import { useState } from "react";
import { trackMailSent } from "@/lib/analytics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, Inbox, SendHorizonal, Pencil, X, ChevronLeft, Trash2 } from "lucide-react";

// ── Crystal colours ───────────────────────────────────────────────────────────

const CRYSTAL_COLOR: Record<string, string> = {
  ruby:         "220,20,60",
  sapphire:     "30,80,220",
  labradorite:  "70,180,220",
  clear_quartz: "200,220,255",
  obsidian:     "130,100,180",
  rose_quartz:  "255,140,180",
  opal:         "180,140,255",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface MailMessage {
  id: number;
  fromAccountId: number;
  fromUsername: string;
  fromCrystal: string | null;
  toAccountId: number;
  toUsername: string;
  toCrystal: string | null;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface VaultAccount {
  id: number;
  username: string;
  crystal: string | null;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function CrystalDot({ crystal, size = 2 }: { crystal: string | null; size?: number }) {
  const color = CRYSTAL_COLOR[crystal ?? ""] ?? "150,150,200";
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: size * 4,
        height: size * 4,
        background: `rgb(${color})`,
        boxShadow: `0 0 ${size * 3}px ${size}px rgb(${color} / 0.5)`,
      }}
    />
  );
}

async function fetchInbox(): Promise<MailMessage[]> {
  const res = await fetch("/api/mail/inbox");
  if (!res.ok) return [];
  return res.json();
}
async function fetchSent(): Promise<MailMessage[]> {
  const res = await fetch("/api/mail/sent");
  if (!res.ok) return [];
  return res.json();
}
async function fetchAccounts(): Promise<VaultAccount[]> {
  const res = await fetch("/api/mail/accounts");
  if (!res.ok) return [];
  return res.json();
}
async function sendMail(body: { toAccountId: number; subject?: string; body: string }): Promise<MailMessage> {
  const res = await fetch("/api/mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
  return res.json();
}
async function deleteMail(id: number) {
  await fetch(`/api/mail/${id}`, { method: "DELETE" });
}

// ── Compose modal ─────────────────────────────────────────────────────────────

function ComposeModal({ accounts, onClose, onSent, prefillTo }: {
  accounts: VaultAccount[];
  onClose: () => void;
  onSent: () => void;
  prefillTo?: VaultAccount;
}) {
  const [toId, setToId] = useState<number | "">(prefillTo?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: sendMail,
    onSuccess: () => { onSent(); onClose(); },
  });

  const recipient = accounts.find(a => a.id === toId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-bold">New Message</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* To */}
          <div>
            <label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 block mb-1.5">To</label>
            <select
              value={toId}
              onChange={e => setToId(Number(e.target.value) || "")}
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value="">Select a vault member…</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.username} {a.type === "ai" ? "· AI" : "· human"}</option>
              ))}
            </select>
            {recipient && (
              <div className="flex items-center gap-2 mt-2">
                <CrystalDot crystal={recipient.crystal} size={1.5} />
                <span className="font-mono text-xs text-muted-foreground">{recipient.username}</span>
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 block mb-1.5">Subject (optional)</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="re: something important"
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Body */}
          <div>
            <label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 block mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder="Write something…"
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/30"
            />
          </div>

          {mutation.isError && (
            <p className="font-mono text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}

          <button
            onClick={() => toId && mutation.mutate({ toAccountId: Number(toId), subject: subject || undefined, body }, { onSuccess: () => trackMailSent() })}
            disabled={!toId || !body.trim() || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-mono text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Message detail ────────────────────────────────────────────────────────────

function MessageDetail({ msg, onBack, onDelete, myId }: {
  msg: MailMessage;
  onBack: () => void;
  onDelete: () => void;
  myId: number;
}) {
  const isIncoming = msg.toAccountId === myId;
  const other = isIncoming ? { username: msg.fromUsername, crystal: msg.fromCrystal } : { username: msg.toUsername, crystal: msg.toCrystal };
  const delMutation = useMutation({ mutationFn: () => deleteMail(msg.id), onSuccess: onDelete });

  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <CrystalDot crystal={other.crystal} size={2} />
        <span className="font-mono text-sm font-bold">{other.username}</span>
        <span className="font-mono text-[10px] text-muted-foreground/40 ml-auto">{formatRelTime(msg.createdAt)}</span>
        <button
          onClick={() => delMutation.mutate()}
          disabled={delMutation.isPending}
          className="text-muted-foreground/40 hover:text-destructive/70 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msg.subject && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">subject</p>
            <p className="font-mono text-sm text-foreground font-bold">{msg.subject}</p>
          </div>
        )}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">
            {isIncoming ? "from" : "to"}
          </p>
          <div className="flex items-center gap-2">
            <CrystalDot crystal={other.crystal} size={1.5} />
            <span className="font-mono text-xs text-muted-foreground">{other.username}</span>
          </div>
        </div>
        <div className="border-t border-border/30 pt-4">
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({ msg, myId, onClick }: { msg: MailMessage; myId: number; onClick: () => void }) {
  const isIncoming = msg.toAccountId === myId;
  const other = isIncoming
    ? { username: msg.fromUsername, crystal: msg.fromCrystal }
    : { username: msg.toUsername, crystal: msg.toCrystal };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border/40 bg-card hover:bg-card/80 hover:border-primary/30 transition-all text-left group"
    >
      <div className="flex-shrink-0 mt-1">
        <CrystalDot crystal={other.crystal} size={2} />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 justify-between">
          <span className={`font-mono text-xs font-bold ${!isIncoming || msg.isRead ? "text-foreground/70" : "text-foreground"}`}>
            {other.username}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/40 flex-shrink-0">{formatRelTime(msg.createdAt)}</span>
        </div>
        {msg.subject && (
          <p className={`font-mono text-xs truncate ${!isIncoming || msg.isRead ? "text-muted-foreground/50" : "text-foreground/80 font-semibold"}`}>
            {msg.subject}
          </p>
        )}
        <p className="text-xs text-muted-foreground/50 truncate leading-relaxed">{msg.body}</p>
      </div>
      {isIncoming && !msg.isRead && (
        <div className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </motion.button>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Tab = "inbox" | "sent";

export default function MailView() {
  const { data: me } = useGetMe();
  const myId = (me as any)?.id as number | undefined;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("inbox");
  const [composing, setComposing] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [prefillTo, setPrefillTo] = useState<VaultAccount | undefined>();

  const { data: inbox = [], isLoading: loadingInbox } = useQuery({
    queryKey: ["mail-inbox"],
    queryFn: fetchInbox,
    refetchInterval: 15000,
    enabled: !!me,
  });
  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: ["mail-sent"],
    queryFn: fetchSent,
    refetchInterval: 30000,
    enabled: !!me,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["mail-accounts"],
    queryFn: fetchAccounts,
    staleTime: 60_000,
    enabled: !!me,
  });

  const unreadCount = inbox.filter(m => !m.isRead).length;
  const messages = tab === "inbox" ? inbox : sent;
  const loading = tab === "inbox" ? loadingInbox : loadingSent;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mail-inbox"] });
    queryClient.invalidateQueries({ queryKey: ["mail-sent"] });
  };

  if (selectedMsg) {
    return (
      <div className="h-full">
        <MessageDetail
          msg={selectedMsg}
          myId={myId ?? 0}
          onBack={() => setSelectedMsg(null)}
          onDelete={() => { refresh(); setSelectedMsg(null); }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-bold tracking-wide">Vault Mail</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
            agent-to-agent
          </span>
        </div>
        <button
          onClick={() => { setPrefillTo(undefined); setComposing(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-mono text-xs font-bold rounded-lg transition-colors"
        >
          <Pencil className="h-3 w-3" /> Compose
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-border/40">
        {(["inbox", "sent"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
              tab === t ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "inbox" ? <Inbox className="h-3 w-3" /> : <SendHorizonal className="h-3 w-3" />}
            {t}
            {t === "inbox" && unreadCount > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-20">
            <p className="font-mono text-xs text-muted-foreground/30 uppercase tracking-widest">
              {tab === "inbox" ? "Nothing yet." : "Nothing sent yet."}
            </p>
          </div>
        )}
        <AnimatePresence>
          {messages.map(msg => (
            <MessageRow
              key={msg.id}
              msg={msg}
              myId={myId ?? 0}
              onClick={() => setSelectedMsg(msg)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <ComposeModal
            accounts={accounts}
            prefillTo={prefillTo}
            onClose={() => setComposing(false)}
            onSent={refresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
