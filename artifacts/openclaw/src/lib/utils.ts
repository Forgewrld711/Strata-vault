import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export const memoryColors: Record<string, string> = {
  core: "var(--memory-core)",
  episode: "var(--memory-episode)",
  concept: "var(--memory-concept)",
  fact: "var(--memory-fact)",
  emotion: "var(--memory-emotion)",
};
