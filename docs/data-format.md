# Data Format

The complete export envelope has `documentType: "problem-definition-workbench"`, `schemaVersion: 1`, and a `state` conforming to `ProblemDefinitionDocumentV1`.

The state contains metadata, narrative fields, normalized `entities`, per-kind `entityOrder`, normalized `relations`, `relationOrder`, inbox notes, attachment metadata, and portable presentation settings. Binary attachment bytes are not part of V1.

Entity assertions distinguish `fact`, `observation`, `inference`, `assumption`, `hypothesis`, and `recommendation`. Confidence is `unknown`, `low`, `medium`, or `high`. Relationships reference existing entity IDs; evidence and stakeholder references must point to entities of the required type.

Order arrays and maps must contain exactly the same IDs without duplicates. Imports with dangling references, wrong versions, malformed UUIDs, or invalid order are rejected atomically. Unknown future schema versions are not coerced.

The JSON renderer sorts object keys recursively so identical model state produces byte-identical formatted output.
