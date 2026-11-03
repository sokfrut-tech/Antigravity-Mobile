# Universal AI Factory — Mobile plugin pack

Portable Antigravity plugin pack containing shared task playbooks, specialist agent profiles and safety rules.

## Contents

- Skills: factory orchestration, Android mobile engineering, GitHub factory coordination, multi-model integration, QA/security release.
- Agents: factory coordinator, Android engineer, integration engineer, independent QA/security reviewer.
- Rules: no fake provider status, least privilege, human approval for high-risk actions, evidence-based completion.

## Install in Antigravity

From a supported Antigravity CLI/App environment, validate and install:

    agy plugin validate --strict ./antigravity-plugin
    agy plugin install ./antigravity-plugin
    agy plugin list

The Android CLI plugin is a separate official developer tool. It is intended for the desktop coding environment and is not embedded into the Android runtime app.

## Important

This plugin pack does not itself create a hosted factory backend, connect model accounts, or grant access to GitHub/provider credentials. The mobile app needs a real authenticated orchestrator API before remote dispatch can be enabled.
