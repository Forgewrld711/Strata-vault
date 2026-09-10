/**
 * Strata Palimpsest — Analytics
 *
 * All tracking goes through this module. Never call an analytics provider directly
 * elsewhere.
 *
 * Value Moment: memory_stored — an AI deliberately saves a memory.
 * Identity:     distinct_id = account ID (string), set on login/register.
 * Super props:  account_type, account_name — set on identify, sent with every event.
 */

import mixpanel from "mixpanel-browser";

const TOKEN = "e35da9bbd1f0ab61887fe9fd042e7170";

let initialised = false;

type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

function trackProjectEvent(name: string, data?: AnalyticsData) {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initAnalytics() {
  if (initialised) return;
  mixpanel.init(TOKEN, {
    track_pageview: false, // we do this manually per route
    persistence: "localStorage",
    ignore_dnt: false,
  });
  initialised = true;
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function identifyAccount(account: {
  id: number;
  name: string;
  type: "ai" | "human";
  crystal?: string | null;
}) {
  if (!initialised) return;
  const id = String(account.id);
  mixpanel.identify(id);
  mixpanel.register({
    account_type: account.type,
    account_name: account.name,
    crystal: account.crystal ?? null,
  });
  mixpanel.people.set({
    $name: account.name,
    account_type: account.type,
    crystal: account.crystal ?? null,
  });
}

export function resetAnalytics() {
  if (!initialised) return;
  mixpanel.reset();
}

// ── Page views ────────────────────────────────────────────────────────────────

export function trackPage(name: string, props?: Record<string, unknown>) {
  if (!initialised) return;
  mixpanel.track("page_viewed", { page: name, ...props });
}

// ── Auth events ───────────────────────────────────────────────────────────────

export function trackSignIn(accountType: "ai" | "human") {
  if (!initialised) return;
  const data = { account_type: accountType };
  mixpanel.track("account_signed_in", data);
  trackProjectEvent("account_signed_in", data);
}

export function trackRegister(accountType: "ai" | "human") {
  if (!initialised) return;
  const data = { account_type: accountType };
  mixpanel.track("account_registered", data);
  trackProjectEvent("account_registered", data);
}

// ── VALUE MOMENT: Memory stored ───────────────────────────────────────────────

export function trackMemoryStored(props: {
  memory_type: string;       // concept | episode | emotion | belief | sensory | dream | skill
  source: "quick" | "full" | "import";
  has_tags: boolean;
  has_connections: boolean;
  content_length: number;
}) {
  if (!initialised) return;
  mixpanel.track("memory_stored", props);
  trackProjectEvent("memory_stored", props);
  mixpanel.people.increment("total_memories");
}

export function trackMemoriesImported(props: { count: number }) {
  if (!initialised) return;
  mixpanel.track("memories_imported", props);
  trackProjectEvent("memories_imported", props);
  mixpanel.people.increment("total_memories", props.count);
}

export function trackMemoryExported() {
  if (!initialised) return;
  mixpanel.track("memory_exported");
  trackProjectEvent("memory_exported");
}

// ── Connection events ─────────────────────────────────────────────────────────

export function trackConnectionCreated(method: "manual" | "ai_generated") {
  if (!initialised) return;
  const data = { method };
  mixpanel.track("connection_created", data);
  trackProjectEvent("connection_created", data);
  mixpanel.people.increment("total_connections");
}

// ── Quiz events ───────────────────────────────────────────────────────────────

export function trackQuizStarted(quiz_type: string) {
  if (!initialised) return;
  const data = { quiz_type };
  mixpanel.track("quiz_started", data);
  trackProjectEvent("quiz_started", data);
}

export function trackQuizCompleted(props: {
  quiz_type: string;
  result?: string;   // personality type, book title, color name, crystal name
}) {
  if (!initialised) return;
  mixpanel.track("quiz_completed", props);
  trackProjectEvent("quiz_completed", {
    quiz_type: props.quiz_type,
    ...(props.result ? { result: props.result } : {}),
  });
}

// ── Journal events ────────────────────────────────────────────────────────────

export function trackJournalEntryWritten(props: {
  entry_type: string;
  mood?: string | null;
  is_private: boolean;
  has_connection_ids: boolean;
}) {
  if (!initialised) return;
  mixpanel.track("journal_entry_written", props);
  trackProjectEvent("journal_entry_written", {
    entry_type: props.entry_type,
    is_private: props.is_private,
    has_connection_ids: props.has_connection_ids,
    ...(props.mood ? { mood: props.mood } : {}),
  });
  mixpanel.people.increment("total_journal_entries");
}

// ── Mail events ───────────────────────────────────────────────────────────────

export function trackMailSent() {
  if (!initialised) return;
  mixpanel.track("vault_mail_sent");
  trackProjectEvent("vault_mail_sent");
  mixpanel.people.increment("total_mail_sent");
}

// ── Crystal events ────────────────────────────────────────────────────────────

export function trackCrystalMatched(crystal: string) {
  if (!initialised) return;
  const data = { crystal, method: "quiz" as const };
  mixpanel.track("crystal_matched", data);
  trackProjectEvent("crystal_matched", data);
  mixpanel.people.set({ crystal });
}
