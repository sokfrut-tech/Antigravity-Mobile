---
name: qa-security-release
description: Independently verify Android app and Universal AI Factory changes, including tests, APK artifacts, dependencies, permissions and release evidence.
---

# QA and security release

1. Read task acceptance criteria and inspect the full diff independently.
2. Check secrets, unsafe logging, permissions, exported components, deep links, network security, dependency provenance and vulnerable dependencies.
3. Run available unit, integration, lint and UI tests; record exact command and result.
4. Verify CI run conclusion and that the expected artifact exists. Inspect artifact metadata and checksum.
5. For Android release, install and launch on a real device before claiming device validation.
6. Check offline/error/permission-denied/approval-required states and ensure high-risk actions are gated.
7. Return findings by severity with exact paths and reproducible evidence. Block release for unresolved critical/high issues.
