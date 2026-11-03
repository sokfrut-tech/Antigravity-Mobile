# Antigravity Mobile

Android-first Kanban client for the Universal AI Factory.

## Current scope

- Three task columns: To Do, In Progress, Done
- Add tasks and move them between columns
- Lightweight Material 3 interface designed for phones
- Debug APK built automatically by GitHub Actions

## Build

The workflow in `.github/workflows/build-apk.yml` builds `app-debug.apk` on pushes to `main` and on manual runs. Download the `antigravity-debug-apk` artifact from the Actions run, unzip it, and install the APK on an Android device.

## Requirements

- Android 7.0 (API 24) or newer
- JDK 17
- Android Gradle Plugin 8.7.3 / Gradle 8.9

This is the first standalone mobile slice. Factory synchronization and remote task storage are not included yet.
