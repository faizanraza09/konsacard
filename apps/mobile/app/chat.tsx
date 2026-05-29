import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "@/theme";
import { useAppStore } from "@/store";
import {
  buildSystemPrompt,
  compactToolResultForModel,
  describeToolCall,
  executeChatTool,
  extractChips,
  type ProfileSink,
  type ToolArgs,
} from "@/lib/chatTools";

const CHAT_ENDPOINT = `${(process.env.EXPO_PUBLIC_DATA_ORIGIN || "https://konsacard.pk").replace(/\/$/, "")}/api/chat`;
const HISTORY_KEY = "konsacard.chat.v1";
const HISTORY_TTL_MS = 7 * 86_400_000;

type Role = "user" | "bot" | "system";

interface DisplayMsg {
  role: Role;
  text: string;
  chips?: string[];
  streaming?: boolean;
  retryText?: string;
}

interface ApiMsg {
  role: "user" | "assistant" | "tool" | "system";
  content?: string | null;
  // OpenAI-shape tool history; passed through the worker to the upstream LLM.
  tool_calls?: Array<{ id?: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

interface PersistedChat {
  ts: number;
  display: DisplayMsg[];
  api: ApiMsg[];
}

const QUICK_QUESTIONS = [
  "Best card for Karachi?",
  "No credit card options?",
  "Highest discount %?",
  "Best low-fee options?",
];

const MAX_TOOL_ROUNDS = 5;

function trimApiMessages(messages: ApiMsg[], maxMessages = 16, maxChars = 14_000): ApiMsg[] {
  const kept: ApiMsg[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    const len = JSON.stringify(row).length;
    if (kept.length && (kept.length >= maxMessages || used + len > maxChars)) break;
    kept.push(row);
    used += len;
  }
  const normalized = kept.reverse();
  const firstUser = normalized.findIndex((m) => m.role === "user");
  return firstUser > 0 ? normalized.slice(firstUser) : normalized;
}

// Upstream LLM responds in OpenAI shape: choices[0].message.{content, tool_calls}.
interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{ id?: string; type: "function"; function: { name: string; arguments: string } }>;
    };
  }>;
  error?: string;
  reason?: string;
}

async function callChat(messages: ApiMsg[], systemPrompt: string, phase: "tool" | "final", maxTokens = 1200, signal?: AbortSignal): Promise<OpenAIChatResponse> {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt, stream: false, maxTokens, phase }),
    signal,
  });
  if (!res.ok) {
    let msg = `Chat error ${res.status}`;
    let reason: string | undefined;
    try {
      const body = await res.json();
      msg = body?.error || msg;
      reason = body?.reason;
    } catch {
      /* ignore */
    }
    const err = new Error(msg) as Error & { status?: number; reason?: string };
    err.status = res.status;
    err.reason = reason;
    throw err;
  }
  return (await res.json()) as OpenAIChatResponse;
}

function parseAssistantMessage(resp: OpenAIChatResponse): { content: string; toolCalls: Array<{ id?: string; type: "function"; function: { name: string; arguments: string } }> } {
  const message = resp?.choices?.[0]?.message;
  if (!message) return { content: "", toolCalls: [] };
  return {
    content: message.content || "",
    toolCalls: message.tool_calls || [],
  };
}

export default function ChatScreen() {
  const [display, setDisplay] = useState<DisplayMsg[]>([
    {
      role: "bot",
      text: "Hi — ask me anything about cards, restaurants, or discounts. I look at the same offers and requirements as the rest of the app.",
    },
  ]);
  const [api, setApi] = useState<ApiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Error state used to surface raw upstream messages; removed to avoid
  // leaking vendor names (e.g. "AI service error 502") into the UI. The
  // in-bubble copy below is what the user sees.
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<FlatList<DisplayMsg>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const insets = useSafeAreaInsets();

  // Pull store + setters once. The store is reactive so this re-renders on changes.
  const storeState = useAppStore();
  const ensureRawOffers = useAppStore((s) => s.ensureRawOffers);
  const setMonthlySalary = useAppStore((s) => s.setMonthlySalary);
  const setAccountBalance = useAppStore((s) => s.setAccountBalance);
  const setOrderValue = useAppStore((s) => s.setOrderValue);
  const setOutingsPerWeek = useAppStore((s) => s.setOutingsPerWeek);

  const profileSink: ProfileSink = useMemo(
    () => ({ setMonthlySalary, setAccountBalance, setOrderValue, setOutingsPerWeek }),
    [setMonthlySalary, setAccountBalance, setOrderValue, setOutingsPerWeek]
  );

  // Chat tools query the raw offers list; make sure it's loaded. Reached via
  // navigation, so the cold-start path may not have loaded it yet.
  useEffect(() => {
    if (!storeState.data) ensureRawOffers();
  }, [storeState.data, ensureRawOffers]);

  // Hydrate persisted chat on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (raw) {
          const parsed: PersistedChat = JSON.parse(raw);
          if (parsed && parsed.ts && Date.now() - parsed.ts < HISTORY_TTL_MS && Array.isArray(parsed.display) && parsed.display.length) {
            setDisplay(parsed.display);
            setApi(Array.isArray(parsed.api) ? parsed.api : []);
          }
        }
      } catch {
        /* ignore corrupt history */
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist whenever messages change (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify({ ts: Date.now(), display, api } satisfies PersistedChat)).catch(() => {});
  }, [display, api, hydrated]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading) return;

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const { signal } = abort;

      setInput("");
      setLoading(true);

      const streamingIdx = display.length + 1;
      setDisplay((d) => [...d, { role: "user", text: t }, { role: "bot", text: "", streaming: true }]);

      const updateStreaming = (patch: Partial<DisplayMsg>) =>
        setDisplay((d) => {
          const copy = [...d];
          if (copy[streamingIdx]) copy[streamingIdx] = { ...copy[streamingIdx], ...patch };
          return copy;
        });

      const systemPrompt = buildSystemPrompt(storeState);
      const timeoutTimer = setTimeout(() => abort.abort(), 60_000);

      try {
        let messages: ApiMsg[] = trimApiMessages([...api, { role: "user", content: t }]);
        let toolsUsed = false;
        let directText = "";

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await callChat(messages, systemPrompt, "tool", 1200, signal);
          const { content, toolCalls } = parseAssistantMessage(resp);

          if (!toolCalls.length) {
            if (!toolsUsed) directText = content;
            break;
          }
          toolsUsed = true;

          const labels = toolCalls.map((tc) => {
            let args: ToolArgs = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
            return describeToolCall(tc.function.name, args);
          });
          updateStreaming({ text: labels.join("\n") });

          const toolResults: ApiMsg[] = toolCalls.map((tc) => {
            let args: ToolArgs = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
            const result = executeChatTool(tc.function.name, args, { state: storeState, sink: profileSink });
            const compact = compactToolResultForModel(tc.function.name, result);
            return {
              role: "tool",
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify(compact),
            };
          });

          messages = trimApiMessages([
            ...messages,
            { role: "assistant", content: content || null, tool_calls: toolCalls },
            ...toolResults,
          ]);
        }

        // Final answer — use the cheap streaming model. We don't actually stream
        // SSE on RN (fetch doesn't expose ReadableStream consistently), so we
        // request non-streaming and treat the whole response as the answer.
        let finalRaw = "";
        if (directText) {
          finalRaw = directText;
        } else {
          const finalResp = await callChat(messages, systemPrompt, "final", 1600, signal);
          finalRaw = parseAssistantMessage(finalResp).content || "…";
        }

        const { text: cleaned, chips } = extractChips(finalRaw);
        updateStreaming({ text: cleaned, chips, streaming: false });
        setApi(trimApiMessages([...messages, { role: "assistant", content: finalRaw }]));
      } catch (e) {
        const error = e as Error & { status?: number; reason?: string; name?: string };
        let userMsg = "⚠️ Connection error. Check your internet and try again.";
        if (error.name === "AbortError") {
          userMsg = "⚠️ Request timed out. Please try again.";
        } else if (error.status === 429) {
          userMsg = error.reason === "daily"
            ? "I've answered a lot of questions today — try again tomorrow when the daily budget resets."
            : "Hourly budget reached — try again in a bit.";
        } else if (error.status && error.status >= 500) {
          userMsg = "⚠️ Chat service is temporarily unavailable. Please try again shortly.";
        } else if (error.status === 400 || error.status === 403) {
          userMsg = "⚠️ Chat configuration error.";
        }
        updateStreaming({ text: userMsg, streaming: false, retryText: t });
      } finally {
        clearTimeout(timeoutTimer);
        if (abortRef.current === abort) abortRef.current = null;
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    },
    [display, api, loading, storeState, profileSink]
  );

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [display.length]);

  const lastVisible = display[display.length - 1];
  const chipsToShow = !loading && lastVisible?.role === "bot" && !lastVisible.streaming
    ? (lastVisible.chips && lastVisible.chips.length ? lastVisible.chips : (display.length === 1 ? QUICK_QUESTIONS : []))
    : [];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        ref={listRef}
        data={display}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Bubble m={item} onRetry={item.retryText ? () => send(item.retryText!) : undefined} />}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          chipsToShow.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {chipsToShow.map((q) => (
                <Pressable key={q} style={styles.quick} onPress={() => send(q)}>
                  <Text style={styles.quickText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null
        }
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      ) : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question…"
          placeholderTextColor={colors.textDim}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          editable={!loading}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, onRetry }: { m: DisplayMsg; onRetry?: () => void }) {
  const mine = m.role === "user";
  return (
    <View style={[styles.bubbleWrap, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{m.text}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: 80 },
  quickRow: {
    flexDirection: "row",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  quick: {
    backgroundColor: colors.bgElev,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  quickText: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  bubbleWrap: { marginBottom: spacing.sm },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubble: { padding: spacing.sm, borderRadius: radii.lg, maxWidth: "85%" },
  bubbleMine: { backgroundColor: colors.brand, borderTopRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bgElev, borderTopLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: typography.size.md, lineHeight: 20 },
  bubbleTextMine: { color: colors.textOnBrand },
  loading: { flexDirection: "row", alignItems: "center", padding: spacing.sm },
  loadingText: { color: colors.textMuted, marginLeft: spacing.xs },
  err: { color: colors.red, padding: spacing.sm, fontSize: typography.size.sm },
  retryBtn: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.pill,
  },
  retryText: { color: colors.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  composer: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElev,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.size.md,
    color: colors.text,
  },
  sendBtn: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
  },
  sendBtnOff: { opacity: 0.5 },
  sendBtnText: { color: colors.textOnBrand, fontWeight: typography.weight.bold },
});
