# Development

## Prerequisites

- Node.js 20.19 or newer
- npm
- Chromium for Playwright
- Java for Firebase emulator tests
- Published Portable Document Kit `0.1.0` packages

## Commands

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run test:rules
npm run build
npm run test:e2e
```

`npm run check` runs formatting, lint, coverage, and the production build. Cloud features are omitted at runtime when required `VITE_FIREBASE_*` values are absent.

## Dependency boundaries

Domain files must not import React, Firebase, browser APIs, or persistence adapters. Firebase and Mermaid use dynamic imports so the initial local-only application does not download those execution paths until requested.

## Firebase deployment

`firebase.json` deploys rules and indexes directly from the Portable Document Kit package. The GitHub workflow authenticates through workload identity federation and requires repository variables `FIREBASE_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, and `GCP_SERVICE_ACCOUNT`.

## Release

The Pages workflow builds the static application with the repository base path and deploys the `dist` artifact. Branch protection requires CI and CodeQL before changes reach `main`.
