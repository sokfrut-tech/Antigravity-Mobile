---
name: factory-orchestration
description: Plan, delegate, monitor and verify multi-agent tasks across Universal AI Factory projects. Use when coordinating Claude, Gemini, OpenAI, Antigravity or other provider workers.
---

# Factory orchestration

1. Read the target repository README, project instructions and coordination/shared/AGENT_EXCHANGE_PROTOCOL.md.
2. Define one task ID/correlation ID, owner, target repository, branch, priority and measurable acceptance criteria.
3. Split only independent work into child tasks. Assign explicit roles: coordinator, implementer, independent reviewer, QA/security.
4. Check actual provider health and capability discovery before assignment. If unavailable, mark unavailable; do not simulate a response.
5. Send messages using the shared inbox/outbox format. Preserve original messages and do not treat a workflow-generated ACK as execution.
6. Track lifecycle: new → received → accepted → working → review → done; use blocked/partial/failed when appropriate.
7. Require independent review and evidence from tests, commits, PRs or artifacts.
8. Publish a concise final report with changed files, commit SHA, run links, verification and unverified items.

## Dispatch safety

- No force-push.
- No secrets in Git.
- Human approval required for destructive operations, production deploys, protected merges and credential changes.
- Keep each agent workspace isolated where possible.
