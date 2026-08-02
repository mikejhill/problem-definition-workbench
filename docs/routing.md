# Routing

The application uses hash routes so every link works on static GitHub Pages.

| Route    | Meaning                                       |
| -------- | --------------------------------------------- |
| `#pdw1:` | Self-contained compressed snapshot            |
| `#pdl1:` | IndexedDB document pointer                    |
| `#pdb1:` | Private cloud document                        |
| `#pdv1:` | Mutable public read-only view                 |
| `#pdp1:` | Public snapshot and independent launch source |
| `#pdi1:` | Collaborative editor invitation               |
| `#new`   | Blank model                                   |
| no hash  | Local curated example                         |

Malformed, corrupt, oversized, unsupported, revoked, unauthorized, and unavailable routes produce explicit recovery screens. They are never silently replaced with a blank document. Oversized URL snapshots are never truncated; the UI directs the user to JSON, device, or cloud storage.
