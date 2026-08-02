# Privacy

Local authoring does not require a network. URL-only documents live in the address fragment. Device documents and command outbox entries live in IndexedDB in the current browser profile.

Self-contained URL snapshots and public publication links expose plaintext document content to anyone who receives the link. They are readable documents, not secrets. Do not place confidential material in them.

Private cloud documents use Firebase Authentication and Firestore rules. Browser Firebase identifiers and App Check site keys are public configuration, not credentials. Deployment credentials remain in GitHub OIDC and Firebase project configuration.

The application does not persist binary attachment content in V1. It stores only attachment names, media types, sizes, descriptions, and optional external references.
