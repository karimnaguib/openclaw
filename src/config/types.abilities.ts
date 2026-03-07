import type {
  ElevatedLevel,
  ReasoningLevel,
  ThinkLevel,
  VerboseLevel,
} from "../auto-reply/thinking.js";

export type AbilityPresetConfig = {
  description?: string;
  think?: ThinkLevel;
  verbose?: VerboseLevel;
  reasoning?: ReasoningLevel;
  elevated?: ElevatedLevel;
  model?: string;
  exec?: {
    host?: "sandbox" | "gateway" | "node";
    security?: "deny" | "allowlist" | "full";
    ask?: "off" | "on-miss" | "always";
    node?: string;
  };
  queue?: {
    mode?:
      | "steer"
      | "followup"
      | "collect"
      | "steer-backlog"
      | "steer+backlog"
      | "queue"
      | "interrupt";
    debounceMs?: number;
    cap?: number;
    dropPolicy?: "old" | "new" | "summarize";
  };
  sendPolicy?: "allow" | "deny";
  responseUsage?: "on" | "off" | "tokens" | "full";
  requires?: {
    webSearch?: boolean;
  };
  preferences?: {
    providers?: string[];
    tools?: string[];
  };
  auto?: {
    enabled?: boolean;
    keywords?: string[];
  };
};

export type AbilitiesConfig = {
  autoRoute?: boolean;
  defaultPreset?: string;
  presets?: Partial<Record<string, AbilityPresetConfig>>;
};
