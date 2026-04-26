# connections

Builds and queries Glen's concept graph — the links between memories.

- weaver.js     Scans all knowledge files, builds graph from connects_to and connections fields.
                Exports buildGraph(), loadGraph(), query(term).
- graph.json    The compiled concept graph. Rebuilt after every session.
