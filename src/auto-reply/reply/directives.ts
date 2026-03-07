import { escapeRegExp } from "../../utils.js";
import type { NoticeLevel, ReasoningLevel } from "../thinking.js";
import {
  type ElevatedLevel,
  normalizeElevatedLevel,
  normalizeNoticeLevel,
  normalizeReasoningLevel,
  normalizeThinkLevel,
  normalizeVerboseLevel,
  type ThinkLevel,
  type VerboseLevel,
} from "../thinking.js";

export type SpeedMode = "fast" | "off" | "status";
export type DeepResearchMode = "on" | "off" | "status" | "o3" | "o4-mini";

type ExtractedLevel<T> = {
  cleaned: string;
  level?: T;
  rawLevel?: string;
  hasDirective: boolean;
};

const matchLevelDirective = (
  body: string,
  names: string[],
): { start: number; end: number; rawLevel?: string } | null => {
  const namePattern = names.map(escapeRegExp).join("|");
  const match = body.match(new RegExp(`(?:^|\\s)\\/(?:${namePattern})(?=$|\\s|:)`, "i"));
  if (!match || match.index === undefined) {
    return null;
  }
  const start = match.index;
  let end = match.index + match[0].length;
  let i = end;
  while (i < body.length && /\s/.test(body[i])) {
    i += 1;
  }
  if (body[i] === ":") {
    i += 1;
    while (i < body.length && /\s/.test(body[i])) {
      i += 1;
    }
  }
  const argStart = i;
  while (i < body.length && /[A-Za-z0-9_-]/.test(body[i])) {
    i += 1;
  }
  const rawLevel = i > argStart ? body.slice(argStart, i) : undefined;
  end = i;
  return { start, end, rawLevel };
};

const extractLevelDirective = <T>(
  body: string,
  names: string[],
  normalize: (raw?: string) => T | undefined,
): ExtractedLevel<T> => {
  const match = matchLevelDirective(body, names);
  if (!match) {
    return { cleaned: body.trim(), hasDirective: false };
  }
  const rawLevel = match.rawLevel;
  const level = normalize(rawLevel);
  const cleaned = body
    .slice(0, match.start)
    .concat(" ")
    .concat(body.slice(match.end))
    .replace(/\s+/g, " ")
    .trim();
  return {
    cleaned,
    level,
    rawLevel,
    hasDirective: true,
  };
};

const extractSimpleDirective = (
  body: string,
  names: string[],
): { cleaned: string; hasDirective: boolean } => {
  const namePattern = names.map(escapeRegExp).join("|");
  const match = body.match(
    new RegExp(`(?:^|\\s)\\/(?:${namePattern})(?=$|\\s|:)(?:\\s*:\\s*)?`, "i"),
  );
  const cleaned = match ? body.replace(match[0], " ").replace(/\s+/g, " ").trim() : body.trim();
  return {
    cleaned,
    hasDirective: Boolean(match),
  };
};

export function extractThinkDirective(body?: string): {
  cleaned: string;
  thinkLevel?: ThinkLevel;
  rawLevel?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(
    body,
    ["thinking", "think", "t", "effort", "reasoning-effort"],
    normalizeThinkLevel,
  );
  return {
    cleaned: extracted.cleaned,
    thinkLevel: extracted.level,
    rawLevel: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractVerboseDirective(body?: string): {
  cleaned: string;
  verboseLevel?: VerboseLevel;
  rawLevel?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(body, ["verbose", "v"], normalizeVerboseLevel);
  return {
    cleaned: extracted.cleaned,
    verboseLevel: extracted.level,
    rawLevel: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractNoticeDirective(body?: string): {
  cleaned: string;
  noticeLevel?: NoticeLevel;
  rawLevel?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(body, ["notice", "notices"], normalizeNoticeLevel);
  return {
    cleaned: extracted.cleaned,
    noticeLevel: extracted.level,
    rawLevel: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractElevatedDirective(body?: string): {
  cleaned: string;
  elevatedLevel?: ElevatedLevel;
  rawLevel?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(body, ["elevated", "elev"], normalizeElevatedLevel);
  return {
    cleaned: extracted.cleaned,
    elevatedLevel: extracted.level,
    rawLevel: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractReasoningDirective(body?: string): {
  cleaned: string;
  reasoningLevel?: ReasoningLevel;
  rawLevel?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(body, ["reasoning", "reason"], normalizeReasoningLevel);
  return {
    cleaned: extracted.cleaned,
    reasoningLevel: extracted.level,
    rawLevel: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractStatusDirective(body?: string): {
  cleaned: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  return extractSimpleDirective(body, ["status"]);
}

function normalizeSpeedMode(raw?: string): SpeedMode | undefined {
  if (!raw) {
    return undefined;
  }
  const key = raw.trim().toLowerCase();
  if (key === "status") {
    return "status";
  }
  if (["fast", "on", "enable", "enabled"].includes(key)) {
    return "fast";
  }
  if (["off", "disable", "disabled"].includes(key)) {
    return "off";
  }
  return undefined;
}

export function extractSpeedDirective(body?: string): {
  cleaned: string;
  speedMode?: SpeedMode;
  rawMode?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(body, ["speed"], normalizeSpeedMode);
  return {
    cleaned: extracted.cleaned,
    speedMode: extracted.level,
    rawMode: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

function normalizeDeepResearchMode(raw?: string): DeepResearchMode | undefined {
  if (!raw) {
    return undefined;
  }
  const key = raw.trim().toLowerCase();
  if (key === "status") {
    return "status";
  }
  if (["on", "enable", "enabled", "default", "o4", "o4-mini"].includes(key)) {
    return key === "o4-mini" ? "o4-mini" : key === "o4" ? "o4-mini" : "on";
  }
  if (["off", "disable", "disabled"].includes(key)) {
    return "off";
  }
  if (["o3", "o3-deep-research"].includes(key)) {
    return "o3";
  }
  return undefined;
}

export function extractDeepResearchDirective(body?: string): {
  cleaned: string;
  deepResearchMode?: DeepResearchMode;
  rawMode?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const extracted = extractLevelDirective(
    body,
    ["deep-research", "deepresearch"],
    normalizeDeepResearchMode,
  );
  return {
    cleaned: extracted.cleaned,
    deepResearchMode: extracted.level,
    rawMode: extracted.rawLevel,
    hasDirective: extracted.hasDirective,
  };
}

export function extractAbilityDirective(body?: string): {
  cleaned: string;
  abilityPreset?: string;
  rawAbility?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }
  const match = body.match(/(?:^|\s)\/ability(?=$|\s|:)/i);
  if (!match || match.index === undefined) {
    return { cleaned: body.trim(), hasDirective: false };
  }
  let i = match.index + match[0].length;
  while (i < body.length && /\s/.test(body[i])) {
    i += 1;
  }
  if (body[i] === ":") {
    i += 1;
    while (i < body.length && /\s/.test(body[i])) {
      i += 1;
    }
  }
  const start = i;
  while (i < body.length && /[A-Za-z_-]/.test(body[i])) {
    i += 1;
  }
  const rawAbility = i > start ? body.slice(start, i) : undefined;
  const cleaned = body
    .slice(0, match.index)
    .concat(" ")
    .concat(body.slice(i))
    .replace(/\s+/g, " ")
    .trim();
  return {
    cleaned,
    abilityPreset: rawAbility?.trim().toLowerCase(),
    rawAbility,
    hasDirective: true,
  };
}

export type { ElevatedLevel, NoticeLevel, ReasoningLevel, ThinkLevel, VerboseLevel };
export { extractExecDirective } from "./exec/directive.js";
