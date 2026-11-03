---
name: android-mobile-engineering
description: Design, implement, test and release the Antigravity Mobile Android app. Use for Kotlin, Jetpack Compose, persistence, networking, background work, adaptive UI and APK delivery.
---

# Android mobile engineering

1. Read docs/MOBILE_FACTORY_ARCHITECTURE.md and current app source before changing code.
2. Keep the phone app a lightweight control plane. Long-running model inference, code execution, MCP stdio servers and browser automation belong in remote workers.
3. Use Kotlin, Jetpack Compose, repository abstractions, Room for durable task/event cache, and WorkManager for bounded retry/sync work. Use secure platform-backed storage only for user session material; never embed service secrets.
4. Use HTTPS, authenticated requests, certificate validation, bounded timeouts, pagination and retry with backoff. Make writes idempotent using task/correlation IDs.
5. Show honest connection and run states: offline, connecting, connected, needs approval, blocked, failed, partial and completed.
6. Support small screens, accessibility, loading/empty/error states and offline cache. Do not display fake progress percentages.
7. Test domain logic, repository/API behavior, Compose UI states, process recreation, offline recovery and Android 7+ compatibility.
8. Build debug APK in CI; for release, sign securely, inspect manifest/permissions, scan dependencies, install and launch on a real device, and publish SHA-256.
9. Never mark device validation complete based only on CI compilation.
