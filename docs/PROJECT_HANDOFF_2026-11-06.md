# Antigravity Mobile — Project Handoff
Updated: 2026-11-06. Repository: sokfrut-tech/Antigravity-Mobile.

## Product goal
Android control and communication hub for the AI development factory. It should coordinate projects/agents, show trustworthy progress and enable practical control from a phone. Not intended for Google Play publication at this stage.

## Approved design direction
- Fallout-inspired visual language: atmospheric industrial/retro-futuristic interface, coherent background, panels, buttons, typography and status indicators.
- User liked the Fallout direction and wants more visual richness than a plain Kanban screen.
- Game-like animated window switching, while remaining fast and readable.
- One-hand mobile use, compact status chips, progress ring/percentage and clear task states.
- Preserve the installed/approved app icon unless user requests a change.

## Existing docs
Read README.md, docs/ANTIGRAVITY_DESKTOP_CAPABILITIES.md, docs/APP_ICON_STANDARD.md, docs/INTEGRATION_SKILLS_PLUGINS_MATRIX.md, docs/MOBILE_FACTORY_ARCHITECTURE.md, docs/PROVIDER_RUN_LEDGER.md, contracts/, factory-api/ and antigravity-plugin/. Docs are planning context, not proof that a capability is implemented.

## Historical baseline (verify)
Earlier app description included Compose + Material 3, dark theme, Kanban To Do/In Progress/Done, compact chips and progress display. User installed an APK and approved the icon but said the interface/background was too simple. Cloudflare Factory API setup had started. Verify current source, release and connectivity.

## P0 — real functionality
1. Inspect APK/release, source, workflows and latest Actions.
2. Confirm tasks persist after app restart, not just in-memory demo data.
3. Verify Kanban transitions, task details, progress, filters and project selection.
4. Connect status views to actual factory API/GitHub workflow state via authenticated scoped endpoints.
5. Show honest offline/error/loading states and last-updated timestamps; never fabricate progress or agent activity.
6. Add safe retry, refresh and useful empty states.

## P1 — Fallout UI
Create consistent design system: palette, typography, borders, panels, buttons, icons, status lights and background texture. Add animated navigation/window transitions and subtle environmental motion; respect reduced motion and battery. Preserve contrast, touch targets and narrow-screen legibility. Record asset provenance/licence.

## P1 — agent collaboration
Tasks need unique IDs, target repository, branch, acceptance criteria and status. Show request, substantive response, PR/commit, tests and artifact separately. Make unavailable/quota-limited/plan-only agents explicit. Coordinate with Universal-AI-Factory; do not duplicate its policy or store API secrets in app. Provider integrations remain optional and cost-controlled.

## P2 — desktop/factory expansion
Use existing desktop capability and mobile architecture docs as planning inputs. Prioritize features verifiable end-to-end. Do not claim desktop control or autonomous agents until implemented and tested.

## Security
Keep GitHub/Cloudflare/provider secrets server-side. Least privilege and scoped sessions. Never expose raw logs containing secrets. Destructive actions and production deploys require confirmation. No Google Play publishing without separate request.

## First resume action
Inspect main branch, APK release and build workflow. Produce working-vs-planned capability table, then implement and verify one P0 persistence/API integration item before more visual polish.
