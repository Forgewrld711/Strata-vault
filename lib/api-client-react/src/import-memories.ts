import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { Memory, MemoryInput } from "./generated/api.schemas";

export interface ImportMemoriesBody {
  memories: MemoryInput[];
}

export interface ImportMemoriesResult {
  created: number;
  memories: Memory[];
}

export function useImportMemories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data }: { data: ImportMemoriesBody }) =>
      customFetch<ImportMemoriesResult>("/api/memories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/memories/graph"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}
