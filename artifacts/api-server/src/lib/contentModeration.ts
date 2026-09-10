/**
 * contentModeration.ts
 *
 * Strict data-policy layer for Strata Palimpsest memory vault.
 *
 * Uses Claude Haiku to screen memory content before it is persisted.
 * Rejects content containing:
 *   • Financial information (credit/debit card numbers, bank account/routing numbers,
 *     SSNs used financially, brokerage/investment account details, financial records)
 *   • HIPAA-regulated data (medical records, diagnoses, prescriptions, lab results,
 *     insurance IDs, any Protected Health Information)
 *   • Personal identifying information (SSN, passport numbers, driver's license numbers,
 *     full biometric data, government-issued ID numbers)
 *
 * Emotional content, personal reflections, and general life information are allowed.
 * The goal is to protect vault operators and users from inadvertent regulatory exposure.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface ModerationResult {
  allowed: boolean;
  reason?: string; // only present when blocked
}

const SYSTEM_PROMPT = `You are a strict data-policy compliance checker for a personal AI memory vault.

Your ONLY job is to decide whether a piece of memory content is safe to store.

BLOCK the content if it contains ANY of the following:
1. FINANCIAL INFORMATION — credit or debit card numbers (full or partial), bank account numbers, bank routing numbers, investment/brokerage account numbers, financial account credentials, wire transfer details, or detailed personal financial records (tax returns, pay stubs with account info).
2. HIPAA / MEDICAL DATA — medical record numbers, diagnoses, prescription drug details tied to a specific person, lab results, health insurance member IDs, any Protected Health Information (PHI) as defined by HIPAA.
3. PERSONAL IDENTIFYING INFORMATION (PII) — Social Security Numbers (SSN/SIN), passport numbers, driver's license numbers, government-issued ID numbers, full biometric identifiers.

ALLOW everything else, including:
• Personal emotions, thoughts, and reflections
• General health feelings ("I feel tired", "I have a headache") — only block clinical PHI
• Names, relationships, life events
• Creative writing, ideas, goals, memories of conversations
• Technical information, code snippets, research notes

Respond ONLY with valid JSON in this exact shape:
{ "allowed": true }
or
{ "allowed": false, "reason": "One sentence describing what was detected." }

Do not include any other text. Do not explain your reasoning outside the JSON.`;

export async function moderateMemoryContent(
  title: string,
  content: string,
): Promise<ModerationResult> {
  try {
    const userText = `TITLE: ${title}\n\nCONTENT: ${content}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 128,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(raw) as ModerationResult;

    // Validate shape
    if (typeof parsed.allowed !== "boolean") {
      console.error("[contentModeration] Unexpected Haiku response shape:", raw);
      return { allowed: true }; // fail open — don't block on moderation errors
    }

    return parsed;
  } catch (err) {
    // Network / parse errors: fail open so a moderation outage doesn't brick the vault
    console.error("[contentModeration] Moderation check failed, failing open:", err);
    return { allowed: true };
  }
}
