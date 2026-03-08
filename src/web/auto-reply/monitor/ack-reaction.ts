import type { loadConfig } from "../../../config/config.js";
import type { WebInboundMsg } from "../types.js";
import { shouldAckReactionForWhatsApp } from "../../../channels/ack-reactions.js";
import { logVerbose } from "../../../globals.js";
import { sendReactionWhatsApp } from "../../outbound.js";
import { formatError } from "../../session.js";
import { resolveGroupActivationFor } from "./group-activation.js";

const GRATITUDE_HINT_RE =
  /\b(thanks?|thank you|thx|ty|appreciate|appreciated|love|loved|awesome|amazing|great|perfect|nice)\b|🙏|❤|❤️|♥/i;
const HEART_EMOJI_RE = /❤|❤️|♥/u;
const THUMBS_UP_EMOJI_RE = /👍/u;

function parseAckEmojiCandidates(raw: string | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/\s*(?:,|\||\/)\s*/u)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function stableEmojiIndex(seed: string, size: number): number {
  let hash = 2166136261;
  for (const char of seed) {
    const codePoint = char.codePointAt(0) ?? 0;
    hash ^= codePoint;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % size;
}

export function selectAckReactionEmoji(params: {
  configuredEmoji: string | undefined;
  messageId: string;
  body: string;
}): string {
  const candidates = parseAckEmojiCandidates(params.configuredEmoji);
  if (candidates.length === 0) {
    return "";
  }
  if (candidates.length === 1) {
    return candidates[0] ?? "";
  }

  const heart = candidates.find((emoji) => HEART_EMOJI_RE.test(emoji));
  const thumbsUp = candidates.find((emoji) => THUMBS_UP_EMOJI_RE.test(emoji));
  if (GRATITUDE_HINT_RE.test(params.body) && heart) {
    return heart;
  }
  if (thumbsUp) {
    return thumbsUp;
  }

  return (
    candidates[stableEmojiIndex(`${params.messageId}:${params.body}`, candidates.length)] ?? ""
  );
}

export function maybeSendAckReaction(params: {
  cfg: ReturnType<typeof loadConfig>;
  msg: WebInboundMsg;
  agentId: string;
  sessionKey: string;
  conversationId: string;
  verbose: boolean;
  accountId?: string;
  info: (obj: unknown, msg: string) => void;
  warn: (obj: unknown, msg: string) => void;
}) {
  if (!params.msg.id) {
    return;
  }

  const ackConfig = params.cfg.channels?.whatsapp?.ackReaction;
  const emoji = selectAckReactionEmoji({
    configuredEmoji: ackConfig?.emoji,
    messageId: params.msg.id,
    body: params.msg.body,
  });
  const directEnabled = ackConfig?.direct ?? true;
  const groupMode = ackConfig?.group ?? "mentions";
  const conversationIdForCheck = params.msg.conversationId ?? params.msg.from;

  const activation =
    params.msg.chatType === "group"
      ? resolveGroupActivationFor({
          cfg: params.cfg,
          agentId: params.agentId,
          sessionKey: params.sessionKey,
          conversationId: conversationIdForCheck,
        })
      : null;
  const shouldSendReaction = () =>
    shouldAckReactionForWhatsApp({
      emoji,
      isDirect: params.msg.chatType === "direct",
      isGroup: params.msg.chatType === "group",
      directEnabled,
      groupMode,
      wasMentioned: params.msg.wasMentioned === true,
      groupActivated: activation === "always",
    });

  if (!shouldSendReaction()) {
    return;
  }

  params.info(
    { chatId: params.msg.chatId, messageId: params.msg.id, emoji },
    "sending ack reaction",
  );
  sendReactionWhatsApp(params.msg.chatId, params.msg.id, emoji, {
    verbose: params.verbose,
    fromMe: false,
    participant: params.msg.senderJid,
    accountId: params.accountId,
  }).catch((err) => {
    params.warn(
      {
        error: formatError(err),
        chatId: params.msg.chatId,
        messageId: params.msg.id,
      },
      "failed to send ack reaction",
    );
    logVerbose(`WhatsApp ack reaction failed for chat ${params.msg.chatId}: ${formatError(err)}`);
  });
}
