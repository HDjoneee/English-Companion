import type { Difficulty, Issue, Scenario } from "../types";

export interface AiCoachTurnRequest {
  scenario: Pick<Scenario, "title" | "role" | "brief" | "keywords" | "phrases">;
  difficulty: Difficulty;
  userText: string;
  localScore: number;
  localIssues: Pick<Issue, "type" | "title" | "original" | "replacement" | "reason">[];
  history: { role: "coach" | "user"; text: string }[];
}

export interface AiCoachTurnResponse {
  configured: boolean;
  coachResponse?: string;
  suggestions?: string[];
  error?: string;
}

export async function requestAiCoachTurn(payload: AiCoachTurnRequest): Promise<AiCoachTurnResponse> {
  try {
    const response = await fetch("/api/coach-turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => ({}))) as AiCoachTurnResponse;
    if (!response.ok) {
      return {
        configured: Boolean(result.configured),
        error: result.error || "MiniMax 大模型请求失败。"
      };
    }
    return result;
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : "MiniMax 大模型请求失败。"
    };
  }
}
