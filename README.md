# Antigravity Mobile

Android-first mobile command center for the Universal AI Factory.

## Current build

- Kotlin + Jetpack Compose
- Android 7.0+ (API 24+)
- Local Kanban board: To Do / In Progress / Done
- Task board is persisted locally and covered by Robolectric tests
- Connection settings use Android Keystore AES-GCM token encryption
- GitHub Actions builds the debug APK and runs unit tests on pull requests
- Factory API bootstrap exists under `factory-api/` but is not deployed yet
- Task synchronization and real provider execution are not enabled yet.

## Antigravity desktop research

See [Antigravity desktop capabilities and mobile adaptation](docs/ANTIGRAVITY_DESKTOP_CAPABILITIES.md) and the [skills/plugins/model integration priority matrix](docs/INTEGRATION_SKILLS_PLUGINS_MATRIX.md).

The desktop platform provides agent workflows, parallel subagents, browser automation, plans/diffs/artifacts, Skills, Rules, MCP servers, plugins and hooks. The mobile app will be a remote control plane for these capabilities, not a full desktop IDE port.

## Factory architecture

See [Mobile × Universal AI Factory architecture](docs/MOBILE_FACTORY_ARCHITECTURE.md).

Target architecture:
- Android client for tasks, agents, sessions, approvals, logs and artifacts.
- Secure factory API/orchestrator.
- Separate workers/adapters for Antigravity, Claude, Gemini and OpenAI.
- MCP gateway and server-side GitHub adapter.
- GitHub inbox/outbox retained as an auditable asynchronous exchange channel.

Do not treat an automatic inbox dispatcher ACK as proof that a model agent accepted or executed a task.

## Antigravity plugin pack

The repository includes a portable plugin pack at [antigravity-plugin](antigravity-plugin/README.md), containing:
- 5 reusable skills;
- 4 specialist agent profiles;
- shared safety rules;
- plugin manifest.

Validate and install it in a supported Antigravity App/CLI environment:

    agy plugin validate --strict ./antigravity-plugin
    agy plugin install ./antigravity-plugin
    agy plugin list

The official Android CLI plugin is a separate developer tool for Antigravity, Claude Code and Codex. It provides Android project/device/test tooling and is not embedded in the mobile runtime app. See https://developer.android.com/tools/agents/android-cli/agent-plugins.

## Factory API bootstrap

See [factory-api/README.md](factory-api/README.md). The Cloudflare Worker + D1 bootstrap supports authenticated task create/list/detail and event history. Its deployment is manual and guarded by GitHub secrets. The Android app can save an HTTPS API address, encrypt a bearer token with Android Keystore, and test `/v1/health`. It can submit local Kanban tasks to the API with stable idempotency keys. Provider dispatch intentionally returns `503 provider_not_configured` until a real agent worker is connected.

## Build

GitHub Actions workflow: .github/workflows/build-apk.yml

Download the antigravity-debug-apk artifact from the relevant Actions run, unzip it and install app-debug.apk on an Android device.

## Requirements

- JDK 17
- Android SDK platform 35
- Gradle 8.9
- Android Gradle Plugin 8.7.3
