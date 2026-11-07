# Antigravity Mobile

Android-first mobile command center for the Universal AI Factory.

## Current build

- Kotlin + Jetpack Compose
- Android 7.0+ (API 24+)
- Local Kanban board: To Do / In Progress / Done
- Task board persistence and Robolectric tests
- Connection settings use Android Keystore AES-GCM token encryption
- GitHub Actions builds the debug APK and runs Android unit/Compose emulator tests
- The Factory API bootstrap Worker has been deployed to Cloudflare: `https://universal-ai-factory-api.sokfrut.workers.dev`
- Deployment evidence: Actions run [41895896111](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41895896111), main commit `51c45cdc39645efe49dda5160d5b7e7f14fb4b80`
- D1 migrations `0002_task_runs.sql`, `0003_task_run_event_guards.sql` and `0004_task_run_outputs.sql` were applied by that deployment.
- Deployment success is not the same as a verified runtime health check. Check `GET /v1/health` before relying on the endpoint from a device.
- Main-branch provider dispatch is not enabled. The integrated provider-dispatch implementation is in draft PR [#19](https://github.com/sokfrut-tech/Antigravity-Mobile/pull/19), not deployed or merged.

## Antigravity desktop research

See [Antigravity desktop capabilities and mobile adaptation](docs/ANTIGRAVITY_DESKTOP_CAPABILITIES.md) and the [skills/plugins/model integration priority matrix](docs/INTEGRATION_SKILLS_PLUGINS_MATRIX.md).

The desktop platform provides agent workflows, parallel subagents, browser automation, plans/diffs/artifacts, Skills, Rules, MCP servers, plugins and hooks. The mobile app is a remote control plane for these capabilities, not a full desktop IDE port.

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

## Factory API

See [factory-api/README.md](factory-api/README.md). The Cloudflare Worker + D1 bootstrap supports authenticated task create/list/detail and event history. The main-branch bootstrap has been deployed; its runtime health still needs an independent check. Provider dispatch is not enabled on main.

Draft PR [#19](https://github.com/sokfrut-tech/Antigravity-Mobile/pull/19) adds the first integrated provider dispatch path. Its exact-head Android build/unit/emulator, Factory API tests and security workflows passed on commit `7a4c7e24e46f0f87018501b9edea59cfd6be4f31` (runs [41894926976](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926976), [41894926000](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926000), [41894926673](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926673)). This does not establish live provider credentials or a real model invocation. The PR is not merged or deployed.

## Build

GitHub Actions workflow: .github/workflows/build-apk.yml

Download the antigravity-debug-apk artifact from the relevant Actions run, unzip it and install app-debug.apk on an Android device.

## Requirements

- JDK 17
- Android SDK platform 35
- Gradle 8.9
- Android Gradle Plugin 8.7.3
