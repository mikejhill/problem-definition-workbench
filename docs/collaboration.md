# Collaboration

Portable Document Kit supplies document-level optimistic concurrency, semantic command targets, an IndexedDB outbox, acknowledgement filtering, listener generations, publications, invitations, roles, checkpoints, and presence.

Owners can add editors or viewers, transfer ownership, revoke members, and issue mutable read-only views, immutable launch sources, and editor invitations. Invitations may establish an anonymous guest session; account collaborators use verified Firebase identities.

Independent semantic targets merge during replay. Changes to the same target report a conflict. Edit-after-delete is rejected while the local command remains recoverable. This is not a character-level CRDT.

Cloud state is optimistic while online and queued while offline. The durable outbox survives restart. Remote acknowledgements cannot be applied twice, and stale listeners cannot replace a newer route.

Copying a document between URL, device, and account storage creates an independent document and does not delete the source.
