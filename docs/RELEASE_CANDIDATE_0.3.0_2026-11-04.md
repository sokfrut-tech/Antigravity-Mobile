# Antigravity Mobile 0.3.0 — debug release candidate

Date: 2026-11-04  
PR: https://github.com/sokfrut-tech/Antigravity-Mobile/pull/19  
Branch: `feat/antigravity-integrated-agent-runtime-final-2026-11-04`

## APK provenance
- Artifact: [antigravity-debug-apk](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41886066087/artifacts/13350738496)
- Workflow run: [41886066087](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41886066087)
- Source commit: `798551378080eeefba68990e422150e75a89ac56`
- File: `app-debug.apk`
- Size: 10,213,774 bytes
- SHA-256: `6562feac3161fa815223d91ef386058ca237205e6433bb303d135a2676656257`
- App version: `0.3.0` (`versionCode=5`)
- Build type: debug-signed sideloadable APK, not a Play Store release.

## Tests at source commit
- Android debug build and unit tests: PASS.
- Compose emulator UI tests: 2 passed, 0 failed.
- Factory API suite: 31 passed, 0 failed.
- Gitleaks: PASS.
- Semgrep: PASS.
- Trivy: PASS.
- CodeQL Kotlin/Java: PASS.

## Scope included
- Fallout-inspired eight-screen mobile command center.
- Existing local task board and encrypted API token storage retained.
- Provider status diagnostics and one-shot task dispatch client.
- Server adapters for Claude Messages, Gemini Interactions and OpenAI Responses.
- Explicit paid-provider confirmation, output cap and immutable run output store.
- Provider output displayed in task card and marked for review, not auto-completed.

## Important release limitations
- This artifact was built from the tested Android source commit above. The later Gemini output-token cap is a server-side change and does not alter the APK; its latest Factory API test run is pending.
- No Cloudflare Worker deployment or remote D1 migration.
- No Claude/Gemini/OpenAI API secrets were configured or used in a live request.
- No external agent has supplied a substantive independent review for PR #19 yet.
- Physical OPPO/Android device validation is NOT TESTED.
- Sessions, Projects, Approvals and full multi-agent review orchestration remain incomplete; this is a debug candidate, not the final product release.
