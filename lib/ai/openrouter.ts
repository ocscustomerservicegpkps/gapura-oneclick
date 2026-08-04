import "server-only";

// Default swapped from llama-3.3-70b (p50 ~25-40s for structured output on OpenRouter)
// to gemini-2.5-flash — 5-10× faster TTFT, matches SLA <10s for AI Summary & Insight.
// Override via OPENROUTER_MODEL env if needed.
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterCallOptions = {
  /** Cap output tokens. Keep small for JSON responses (e.g. 1024). */
  maxTokens?: number;
  /** Sampling temperature. Default 0.1 (deterministic). */
  temperature?: number;
  /** Set 'json_object' to force strict JSON output — skip markdown parsing. */
  responseFormat?: "json_object";
  /** Abort after this many ms. Default 25000 (below 30s SLA). */
  timeoutMs?: number;
};

type OpenRouterChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function callOpenRouterAI(
  messages: OpenRouterMessage[],
  model: string = OPENROUTER_MODEL,
  maxTokensOrOptions: number | OpenRouterCallOptions = 4096
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const opts: OpenRouterCallOptions =
    typeof maxTokensOrOptions === "number"
      ? { maxTokens: maxTokensOrOptions }
      : maxTokensOrOptions;

  const {
    maxTokens = 4096,
    temperature = 0.1,
    responseFormat,
    timeoutMs = 25000,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.OPENROUTER_HTTP_REFERER
          ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { "X-Title": process.env.OPENROUTER_APP_NAME }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        // Route to the fastest available provider variant for this model.
        // Cuts p50 latency dramatically vs. OpenRouter's default (cheapest).
        provider: { sort: "throughput" },
        // gemini-2.5-flash "thinks" by default on OpenRouter — hidden reasoning
        // tokens before any visible output, the main source of 15s+ latency.
        // Every caller here wants a fast direct answer, not chain-of-thought.
        reasoning: { enabled: false },
        ...(responseFormat
          ? { response_format: { type: responseFormat } }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const completion = (await response.json()) as OpenRouterChatCompletion;
    return completion.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("[OpenRouter] Error calling AI:", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
