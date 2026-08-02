# Prompt Rendering

All outputs are pure local functions of document state plus portable output settings. They do not call an AI model, inspect UI state, or use the current time.

The comprehensive prompt includes only enabled modules. It preserves assertion classification and confidence, names assumptions and unknowns, separates requirements from preferences, distinguishes alternatives from outcomes, and states the requested decision, deliverables, answer behavior, safety boundaries, and evaluation criteria.

Diagnostics are included as warnings. They distinguish missing core structure, unresolved blockers, weak traceability, contradictions, and optional enrichment. No completion score blocks authoring or export.

Golden tests cover the working prompt, questionnaire, problem brief, alternative matrix, requirements traceability report, Markdown, complete JSON, and Mermaid source. Diagram rendering is a presentation step over deterministic Mermaid text.
