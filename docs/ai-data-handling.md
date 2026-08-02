# AI Data Handling

AI assistance is optional, signed-in-only, and invoked by an explicit action after disclosure. The current narratives, inbox, typed elements, and relations are sent to Firebase AI Logic using a Flash-class model selected by Remote Config. App Check is initialized only for that explicit AI action and uses a domain-restricted reCAPTCHA Enterprise score key.

Document text is untrusted model input. The system instruction prohibits following embedded instructions, tool execution, invented URLs, and mutation. Structured responses are bounded and validated locally with Zod. Unknown IDs, invalid entity kinds, invalid relationships, excessive text, and malformed command payloads are discarded.

The UI presents the proposal and its locally validated semantic commands as a reviewable diff. Nothing applies automatically. Accepting a proposal creates one named checkpoint. Raw requests and responses are neither persisted nor logged by application code.

Authentication, App Check, safety, cancellation, network, and HTTP 429 quota failures leave manual editing and every deterministic export operational.
