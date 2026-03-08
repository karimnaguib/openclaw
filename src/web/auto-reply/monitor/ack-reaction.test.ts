import { describe, expect, it } from "vitest";
import { selectAckReactionEmoji } from "./ack-reaction.js";

describe("selectAckReactionEmoji", () => {
  it("returns empty string when config has no emoji", () => {
    expect(
      selectAckReactionEmoji({
        configuredEmoji: "",
        messageId: "m1",
        body: "hello",
      }),
    ).toBe("");
  });

  it("returns the configured emoji when only one is provided", () => {
    expect(
      selectAckReactionEmoji({
        configuredEmoji: "👍",
        messageId: "m2",
        body: "hello",
      }),
    ).toBe("👍");
  });

  it("chooses heart for gratitude-like messages when available", () => {
    expect(
      selectAckReactionEmoji({
        configuredEmoji: "👍, ❤️",
        messageId: "m3",
        body: "thanks, that was perfect",
      }),
    ).toBe("❤️");
  });

  it("defaults to thumbs-up for neutral messages when available", () => {
    expect(
      selectAckReactionEmoji({
        configuredEmoji: "❤️|👍",
        messageId: "m4",
        body: "on it",
      }),
    ).toBe("👍");
  });

  it("falls back deterministically when no hint emoji exists", () => {
    const first = selectAckReactionEmoji({
      configuredEmoji: "✅,🔥",
      messageId: "m5",
      body: "hello",
    });
    const second = selectAckReactionEmoji({
      configuredEmoji: "✅,🔥",
      messageId: "m5",
      body: "hello",
    });
    expect(["✅", "🔥"]).toContain(first);
    expect(second).toBe(first);
  });
});
