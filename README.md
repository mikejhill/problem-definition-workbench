# Problem Definition Workbench

A local-first React application for turning an ambiguous concern into a durable, traceable problem definition. The document model is authoritative; prompts, briefs, questionnaires, reports, JSON, and Mermaid diagrams are deterministic projections.

Manual authoring, diagnostics, import, export, URL snapshots, and on-device persistence work without an account, Firebase, or AI. Cloud collaboration and Firebase AI Logic are optional adapters.

## Development

Requires Node.js 20.19 or newer and the exact Portable Document Kit `0.1.0` packages published to npm.

```powershell
npm ci
npm run dev
```

Run the full local verification pipeline with `npm run check`. Run browser smoke tests with `npx playwright install chromium` followed by `npm run test:e2e`.

Firebase is disabled unless the public `VITE_FIREBASE_*` values in `.env.example` are configured. No Firebase credential belongs in the browser bundle.

## Architecture

- `src/domain`: schemas, normalized model, relations, commands, reducer, diagnostics, renderers, and curated example.
- `src/services`: explicit browser, Portable Document Kit, Firebase, clipboard, and download adapters.
- `src/components`: three-region workbench UI and responsive equivalents.
- `docs`: durable contracts for the data format, outputs, privacy, routing, collaboration, AI, and development.

See [Architecture](docs/architecture.md) and [Development](docs/development.md).

## License

MIT
