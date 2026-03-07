import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { AbilityPresetConfig } from "../../config/types.abilities.js";
import type { InlineDirectives } from "./directive-handling.parse.js";

export type ResolvedAbilityPreset = {
  name: string;
  config: AbilityPresetConfig;
  source: "user" | "auto" | "default";
  degraded: boolean;
  degradedReason?: string;
  degradedDetails?: string;
};

const BUILTIN_PRESETS: Record<string, AbilityPresetConfig> = {
  default: {
    description: "Balanced default behavior.",
  },
  fast: {
    description: "Lower-latency concise mode.",
    think: "minimal",
    responseUsage: "off",
    queue: { mode: "interrupt" },
    auto: { enabled: true, keywords: ["fast", "quick", "brief"] },
  },
  deep: {
    description: "Higher-effort reasoning mode.",
    think: "high",
    reasoning: "on",
    responseUsage: "tokens",
    auto: { enabled: true, keywords: ["deep", "carefully", "think hard", "reason through"] },
  },
  research: {
    description: "Source-oriented research mode.",
    think: "high",
    reasoning: "on",
    responseUsage: "tokens",
    requires: { webSearch: true },
    auto: {
      enabled: true,
      keywords: ["research", "look up", "latest", "sources", "find online"],
    },
  },
  safe: {
    description: "Risk-constrained mode.",
    think: "low",
    elevated: "off",
  },
  ops: {
    description: "Execution-oriented terminal mode.",
    think: "medium",
    verbose: "on",
    responseUsage: "tokens",
    exec: {
      host: "gateway",
      security: "allowlist",
      ask: "on-miss",
    },
    auto: { enabled: true, keywords: ["run", "terminal", "shell", "patch", "fix", "repo"] },
  },
};

export function resolveAbilityPresets(cfg?: OpenClawConfig): Record<string, AbilityPresetConfig> {
  const merged: Record<string, AbilityPresetConfig> = { ...BUILTIN_PRESETS };
  for (const [name, preset] of Object.entries(cfg?.abilities?.presets ?? {})) {
    if (preset) {
      merged[name] = preset;
    }
  }
  return merged;
}

export function resolveAbilityPresetByName(
  cfg: OpenClawConfig,
  name?: string | null,
): AbilityPresetConfig | undefined {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  return key ? resolveAbilityPresets(cfg)[key] : undefined;
}

export function resolveDefaultAbilityPresetName(cfg?: OpenClawConfig): string | undefined {
  const key = String(cfg?.abilities?.defaultPreset ?? "")
    .trim()
    .toLowerCase();
  if (!key || key === "off" || key === "status") {
    return undefined;
  }
  return key;
}

function hasWebSearch(cfg: OpenClawConfig): boolean {
  const search = cfg.tools?.web?.search;
  if (!search || search.enabled === false) {
    return false;
  }
  if (search.provider === "perplexity") {
    return Boolean(search.perplexity?.apiKey || process.env.PERPLEXITY_API_KEY);
  }
  if (search.provider === "grok") {
    return Boolean(search.grok?.apiKey || process.env.XAI_API_KEY);
  }
  return Boolean(search.apiKey || process.env.BRAVE_API_KEY);
}

export function resolveAbilityDegradation(
  cfg: OpenClawConfig,
  _name: string,
  preset: AbilityPresetConfig,
): { degraded: boolean; reason?: string; details?: string } {
  if (preset.requires?.webSearch && !hasWebSearch(cfg)) {
    return {
      degraded: true,
      reason: "web_search_unavailable",
      details: "web_search is unavailable",
    };
  }
  return { degraded: false };
}

export function resolveActiveAbilityPreset(params: {
  cfg: OpenClawConfig;
  sessionEntry?: SessionEntry;
  directives?: Pick<InlineDirectives, "hasAbilityDirective" | "abilityPreset" | "abilitySource">;
}): ResolvedAbilityPreset | undefined {
  const nextName =
    params.directives?.hasAbilityDirective && params.directives.abilityPreset
      ? params.directives.abilityPreset
      : (params.sessionEntry?.abilityPreset ?? resolveDefaultAbilityPresetName(params.cfg));
  const name = String(nextName ?? "")
    .trim()
    .toLowerCase();
  if (!name || name === "off" || name === "status") {
    return undefined;
  }
  const preset = resolveAbilityPresetByName(params.cfg, name);
  if (!preset) {
    return undefined;
  }
  const degraded = resolveAbilityDegradation(params.cfg, name, preset);
  return {
    name,
    config: preset,
    source:
      (params.directives?.hasAbilityDirective
        ? params.directives.abilitySource
        : params.sessionEntry?.abilityPresetSource) ?? "default",
    degraded: degraded.degraded,
    degradedReason: degraded.reason,
    degradedDetails: degraded.details,
  };
}

export function resolveAutoAbilityPreset(params: {
  cfg: OpenClawConfig;
  text: string;
}): { name: string; source: "auto" } | undefined {
  if (params.cfg.abilities?.autoRoute === false) {
    return undefined;
  }
  const text = params.text.trim().toLowerCase();
  if (!text) {
    return undefined;
  }
  if (
    /\b(search the web|look (it|this|that) up|research\b|find sources|with citations|latest (news|info|information|updates?)|current (news|info|information)|recent developments?)\b/i.test(
      text,
    )
  ) {
    return { name: "research", source: "auto" };
  }
  if (
    /\b(step[- ]by[- ]step|deep dive|thorough(?:ly)?|careful(?:ly)?|analyze deeply|think hard|take your time)\b/i.test(
      text,
    )
  ) {
    return { name: "deep", source: "auto" };
  }
  if (
    /\b(ssh|kubectl|docker|tail logs?|check logs?|restart service|deploy|shell command|terminal command|run (?:this )?(?:command|cmd)|bash)\b/i.test(
      text,
    )
  ) {
    return { name: "ops", source: "auto" };
  }
  if (
    /\b(quick answer|brief answer|be brief|short answer|fast answer|quickly|tldr|tl;dr)\b/i.test(
      text,
    )
  ) {
    return { name: "fast", source: "auto" };
  }
  return undefined;
}

export function applyAbilityPresetToEmptyFields(
  entry: SessionEntry,
  preset: AbilityPresetConfig,
): void {
  if (entry.thinkingLevel === undefined && preset.think) {
    entry.thinkingLevel = preset.think;
  }
  if (entry.verboseLevel === undefined && preset.verbose) {
    entry.verboseLevel = preset.verbose;
  }
  if (entry.reasoningLevel === undefined && preset.reasoning) {
    entry.reasoningLevel = preset.reasoning;
  }
  if (entry.elevatedLevel === undefined && preset.elevated) {
    entry.elevatedLevel = preset.elevated;
  }
  if (entry.execHost === undefined && preset.exec?.host) {
    entry.execHost = preset.exec.host;
  }
  if (entry.execSecurity === undefined && preset.exec?.security) {
    entry.execSecurity = preset.exec.security;
  }
  if (entry.execAsk === undefined && preset.exec?.ask) {
    entry.execAsk = preset.exec.ask;
  }
  if (entry.execNode === undefined && preset.exec?.node) {
    entry.execNode = preset.exec.node;
  }
  if (entry.queueMode === undefined && preset.queue?.mode) {
    entry.queueMode = preset.queue.mode;
  }
  if (entry.queueDebounceMs === undefined && typeof preset.queue?.debounceMs === "number") {
    entry.queueDebounceMs = preset.queue.debounceMs;
  }
  if (entry.queueCap === undefined && typeof preset.queue?.cap === "number") {
    entry.queueCap = preset.queue.cap;
  }
  if (entry.queueDrop === undefined && preset.queue?.dropPolicy) {
    entry.queueDrop = preset.queue.dropPolicy;
  }
  if (entry.sendPolicy === undefined && preset.sendPolicy) {
    entry.sendPolicy = preset.sendPolicy;
  }
  if (entry.responseUsage === undefined && preset.responseUsage) {
    entry.responseUsage = preset.responseUsage;
  }
}

export function clearAbilityPresetEffects(entry: SessionEntry, preset?: AbilityPresetConfig): void {
  if (!preset) {
    return;
  }
  if (preset.think && entry.thinkingLevel === preset.think) {
    delete entry.thinkingLevel;
  }
  if (preset.verbose && entry.verboseLevel === preset.verbose) {
    delete entry.verboseLevel;
  }
  if (preset.reasoning && entry.reasoningLevel === preset.reasoning) {
    delete entry.reasoningLevel;
  }
  if (preset.elevated && entry.elevatedLevel === preset.elevated) {
    delete entry.elevatedLevel;
  }
  if (preset.exec?.host && entry.execHost === preset.exec.host) {
    delete entry.execHost;
  }
  if (preset.exec?.security && entry.execSecurity === preset.exec.security) {
    delete entry.execSecurity;
  }
  if (preset.exec?.ask && entry.execAsk === preset.exec.ask) {
    delete entry.execAsk;
  }
  if (preset.exec?.node && entry.execNode === preset.exec.node) {
    delete entry.execNode;
  }
  if (preset.queue?.mode && entry.queueMode === preset.queue.mode) {
    delete entry.queueMode;
  }
  if (
    typeof preset.queue?.debounceMs === "number" &&
    entry.queueDebounceMs === preset.queue.debounceMs
  ) {
    delete entry.queueDebounceMs;
  }
  if (typeof preset.queue?.cap === "number" && entry.queueCap === preset.queue.cap) {
    delete entry.queueCap;
  }
  if (preset.queue?.dropPolicy && entry.queueDrop === preset.queue.dropPolicy) {
    delete entry.queueDrop;
  }
  if (preset.sendPolicy && entry.sendPolicy === preset.sendPolicy) {
    delete entry.sendPolicy;
  }
  if (preset.responseUsage && entry.responseUsage === preset.responseUsage) {
    delete entry.responseUsage;
  }
  if (preset.model) {
    const slash = preset.model.indexOf("/");
    if (
      slash > 0 &&
      entry.providerOverride === preset.model.slice(0, slash) &&
      entry.modelOverride === preset.model.slice(slash + 1)
    ) {
      delete entry.providerOverride;
      delete entry.modelOverride;
    }
  }
}
