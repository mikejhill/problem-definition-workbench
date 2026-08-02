# Architecture

## Core rule

`ProblemDefinitionDocumentV1` is the sole durable product model. React state holds only transient navigation, panels, filters, dialog drafts, and notices. Outputs never become alternate sources of truth.

## Layers

1. The domain layer defines Zod schemas, normalized entities, typed relations, semantic commands, immutable reduction, diagnostics, and deterministic renderers. It has no React or Firebase dependency.
2. Portable Document Kit validates commands and reducer results, assigns command targets, coalesces exact-field typing, manages checkpoints, routes, IndexedDB persistence, optimistic concurrency, publications, invitations, and presence.
3. Browser services provide history, URL snapshots, downloads, and clipboard access through explicit adapters.
4. React presents a navigable outline, focused authoritative editor, and contextual diagnostics/output inspector. Narrow screens expose the same regions as tabs.
5. Firebase and AI are lazy optional adapters. Their failure cannot disable the domain or browser layers.

## Invariants

- Every entity has a stable UUID. Maps store entities and separate arrays store order.
- References use entity IDs and typed validated relations. Display names are projections.
- Significant assertions preserve classification, confidence, source, evidence references, and stakeholder references.
- Every command and resulting state crosses the Portable Document Kit Standard Schema boundary.
- Structural changes, imports, relation edits, and accepted AI proposals commit immediately. Typing coalesces only for an exact target and field.
- Imports parse and validate before a single replace command. Partial imports are impossible.
- A public launch source creates an independent document. It never mutates the publication.
