---
name: github-factory-coordination
description: Exchange tasks and reports through Universal AI Factory GitHub inbox/outbox, and verify commits, pull requests, workflow runs and artifacts.
---

# GitHub factory coordination

1. Read coordination/shared/AGENT_EXCHANGE_PROTOCOL.md from the Universal AI Factory repository.
2. Inspect relevant inbox/outbox before creating a message; avoid duplicate task dispatch.
3. Create a new immutable Markdown inbox message with author, recipient, UTC timestamp, project, status, priority, branch/PR/commit and correlation ID.
4. Never include tokens, credentials, private data or secret URLs.
5. A dispatcher-generated ACK is only a receipt. Confirm a real agent response in its outbox, matching the original file and correlation ID.
6. Verify claimed changes using repository diff and commit SHA. Verify builds using the actual Actions run and artifact list.
7. Report exactly what is proven and what remains unverified. GitHub file presence alone does not prove an external agent read the message.
