# Antigravity Mobile — factory security tooling

This repository is onboarded to the security lane defined by
`Universal-AI-Factory/docs/CYBERSECURITY_SKILLS_FACTORY_STANDARD.md`.

## Automated checks

The `.github/workflows/factory-security.yml` workflow runs on pull requests,
pushes to the default branch, weekly, and by manual dispatch:

| Tool | Purpose | Gate |
|---|---|---|
| Gitleaks | Exposed credentials and secrets, including repository history | Blocks on detected secrets |
| Semgrep | Static application-security rules across supported source files | Blocks on findings selected by the automatic ruleset |
| Trivy | Dependency vulnerabilities and infrastructure/configuration misconfigurations | Blocks on unfixed Critical/High findings |
| CodeQL | Kotlin/Java static analysis | Publishes SARIF to GitHub Code Scanning where supported |

The existing Android build and Factory API checks remain separate and continue
to run. This security workflow does not deploy the Worker, change production
secrets, or perform active scans against a live endpoint.

## Runtime and reverse-engineering tools

These tools from the factory's security toolkit are **lab-only/manual**, not
unconditionally executed in GitHub Actions:

- **OWASP ZAP Baseline** — passive web/API scan against an explicitly approved
  staging URL. Do not point it at third-party systems or production without
  a separately approved test window.
- **Nuclei** — opt-in template-based checks against explicitly authorized
  assets only. Review templates and rate limits before execution.
- **Wireshark** — capture and inspect traffic from a dedicated test device or
  isolated lab; redact tokens, cookies, personal data and payloads before
  attaching captures to issues.
- **Sysmon** and **Process Hacker/System Informer** — Windows host/process
  telemetry for a Windows test machine. They do not run inside Android CI.
- **Ghidra** — offline APK/native-library reverse engineering in a controlled
  analysis environment. Preserve APK SHA-256 and record the exact artifact
  analyzed.
- **IDA Free** and **Binary Ninja** — optional analyst workbenches; licensing
  and feature limits apply. They are not required CI dependencies.

A scanner that is not configured or not run must be reported as
NOT CONFIGURED / NOT RUN, never as PASS. Findings require triage and a
reproducible evidence record. Do not upload raw packet captures, APK signing
keys, tokens, production databases or user data to CI artifacts.

## Release interpretation

A green workflow means only that the configured checks passed for the tested
commit. It does not establish runtime security of a deployed service, Android
device, cloud account, API, network path or external provider integration.
