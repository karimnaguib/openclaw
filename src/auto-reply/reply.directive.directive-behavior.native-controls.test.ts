import "./reply.directive.directive-behavior.e2e-mocks.js";
import { describe, expect, it } from "vitest";
import { loadSessionStore } from "../config/sessions.js";
import {
  installDirectiveBehaviorE2EHooks,
  makeWhatsAppDirectiveConfig,
  replyText,
  sessionStorePath,
  withTempHome,
} from "./reply.directive.directive-behavior.e2e-harness.js";
import { getReplyFromConfig } from "./reply.js";

describe("native control behavior", () => {
  installDirectiveBehaviorE2EHooks();

  it("deprecates ability presets", async () => {
    await withTempHome(async (home) => {
      const storePath = sessionStorePath(home);
      const cfg = makeWhatsAppDirectiveConfig(
        home,
        { model: "anthropic/claude-opus-4-5" },
        { session: { store: storePath } },
      );

      const res = await getReplyFromConfig(
        { Body: "/ability fast", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        cfg,
      );

      expect(replyText(res)).toContain("Ability presets were removed");
      const store = loadSessionStore(storePath);
      expect(store["agent:main:main"]?.abilityPreset).toBeUndefined();
    });
  });

  it("accepts /effort as an alias for reasoning effort", async () => {
    await withTempHome(async (home) => {
      const storePath = sessionStorePath(home);
      const cfg = makeWhatsAppDirectiveConfig(
        home,
        { model: "anthropic/claude-opus-4-5" },
        { session: { store: storePath } },
      );

      const res = await getReplyFromConfig(
        { Body: "/effort high", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        cfg,
      );

      expect(replyText(res)).toContain("Effort set to high");
      const store = loadSessionStore(storePath);
      expect(store["agent:main:main"]?.thinkingLevel).toBe("high");
    });
  });

  it("reports native speed mode as unsupported on the API runtime", async () => {
    await withTempHome(async (home) => {
      const storePath = sessionStorePath(home);
      const cfg = makeWhatsAppDirectiveConfig(
        home,
        { model: "openai-codex/gpt-5.4" },
        { session: { store: storePath } },
      );

      const res = await getReplyFromConfig(
        { Body: "/speed fast", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        cfg,
      );

      expect(replyText(res)).toContain("Native speed mode is unavailable here");
    });
  });

  it("switches to native deep research only when OpenAI API auth is available", async () => {
    await withTempHome(async (home) => {
      const storePath = sessionStorePath(home);
      const cfg = makeWhatsAppDirectiveConfig(
        home,
        { model: "anthropic/claude-opus-4-5" },
        { session: { store: storePath } },
      );

      const prev = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "sk-test";
      try {
        const res = await getReplyFromConfig(
          { Body: "/deep-research on", From: "+1222", To: "+1222", CommandAuthorized: true },
          {},
          cfg,
        );

        expect(replyText(res)).toContain("Deep research set to o4-mini-deep-research");
        const store = loadSessionStore(storePath);
        expect(store["agent:main:main"]?.providerOverride).toBe("openai");
        expect(store["agent:main:main"]?.modelOverride).toBe("o4-mini-deep-research");
      } finally {
        if (prev === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = prev;
        }
      }
    });
  });
});
