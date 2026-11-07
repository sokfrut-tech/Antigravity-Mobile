# Fallout / Wasteland UI implementation contract

Status: implementation plan for PR #14. This document is a checklist, not a claim that the screens are already implemented.

## Reference interpretation

The supplied `122.png` is a 4-by-2 collage of eight distinct mobile screen mockups. It is not a wallpaper and must never be stretched across the app as one background image. Rebuild the layouts as native Jetpack Compose UI. Crop/reuse only individual artwork regions when their source quality and licensing are suitable; otherwise use locally bundled, original layered artwork and Compose surfaces.

## Screen map

| Reference panel | Compose destination | Required content and behavior |
|---|---|---|
| 1. Splash | `Splash` | Antigravity identity, wasteland atmosphere, restrained loading indicator; no artificial delay that blocks startup. |
| 2. Home | `Home` | Greeting, assistant entry, search/translation shortcuts, task summary, settings entry, bottom navigation. |
| 3. Voice assistant | `Voice` | Pip-Boy-inspired microphone/radar visual, clear idle/listening/error states, examples and stop action. Do not fake speech recognition when no ASR engine is connected. |
| 4. Tools | `Tools` | Search, Chinese/English-to-Russian translation, speech, calculator, files/notes and links. Show only implemented tools; unavailable integrations must be visibly marked. |
| 5. Information | `Information` | Readable lore/help content, wasteland illustration, action link and paging where content exists. |
| 6. Tasks | `Tasks` | Preserve the existing Kanban states, local persistence, task create/delete/move, Factory API submission and real remote progress polling. |
| 7. Settings | `Settings` | Russian language, voice settings only when supported, theme selector, notifications/offline/update options only when implemented, app version, API connection settings. |
| 8. Closing/about | `About` | Antigravity identity, power-armor/wasteland-inspired locally bundled artwork and Russian tagline; links/actions must be real. |

## Visual system

- Pip-Boy phosphor green is an accent, not the body-text color for every element.
- Use dark graphite/olive surfaces, muted brass framing, restrained amber highlights, readable warm-white text, consistent spacing and clear focus/pressed/disabled states.
- Use scalable vector or density-independent assets where possible. Raster art belongs in local Android resources and must be bundled into the APK; no runtime image fetch.
- Avoid text embedded in raster art. All labels must remain selectable/accessibility-readable Compose text.
- Provide content descriptions for meaningful images and icons; decorative art is excluded from accessibility traversal.
- Verify compact screens and large font scale; no clipped labels or horizontally overflowing controls.

## Non-regression requirements

- Keep `minSdk 24` (Android 7.0).
- Preserve offline-first task storage and existing task identifiers/status transitions.
- Preserve Factory API base URL and encrypted token storage; never log or display the bearer token.
- Preserve task submission, remote task ID tracking, and progress polling. A local animation must not imply remote work is running.
- Keep network-dependent functions honest about missing provider configuration and failures.
- No secrets, tokens, or credentials in source, tests, screenshots, artifacts, or logs.

## Required tests before PR is ready

1. Compose navigation reaches all implemented destinations and back navigation works.
2. Task creation, status movement and deletion remain functional.
3. Task state survives Activity recreation and process/app restart.
4. API settings preserve URL and encrypted token behavior; empty token update does not erase a saved token unless explicitly requested.
5. Submission success stores remote task ID; submission failure is shown without losing the local task.
6. Progress states distinguish queued/running/completed/failed and never invent percentages.
7. Accessibility semantics and larger font scale have no critical clipping.
8. Debug APK, unit tests, emulator UI tests and security workflow pass on the final PR head.

## Evidence required in the PR

Attach emulator screenshots for each implemented destination, test report links, APK artifact/run ID, final head SHA, minSdk confirmation, and a concise list of any intentionally unavailable functions. Physical-device validation must be reported separately and only if actually performed.
