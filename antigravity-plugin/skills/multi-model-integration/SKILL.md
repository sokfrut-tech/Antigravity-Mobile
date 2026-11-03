---
name: multi-model-integration
description: Design provider-neutral orchestration and integrate Antigravity, Claude, Gemini and OpenAI models through safe adapters and capability discovery.
---

# Multi-model integration

## Architecture

- Keep a provider-neutral task/run/event contract in the factory orchestrator.
- Implement one adapter per provider/runtime. Each adapter owns authentication, model selection, request translation, streaming/polling, cancellation, tool permissions, usage and error normalization.
- Discover capabilities at runtime: text, image, audio, code execution, browser, MCP, subagents, structured output and context limits. Never assume feature parity.
- Record provider, model identifier, capability snapshot, timestamps and correlation ID for every run.
- Use a model router that selects only from connected providers and can explain the choice. Add fallback only when policy allows it and preserve the same task/run audit trail.
- Keep API keys in a backend secret manager. The Android client receives only a short-lived authenticated session and safe provider status metadata.

## Suggested initial roles

- Planner: decompose task and acceptance criteria.
- Researcher: inspect docs and code without editing.
- Implementer: make scoped changes in an isolated worktree.
- Reviewer: read-only independent diff review.
- QA/security: run tests and inspect risk.

## Safe rollout

Start with one provider end-to-end. Add Claude, Gemini, OpenAI and Antigravity workers separately after health checks and permissions are proven. Never claim a provider is online because a configuration file exists.
