# Topological Root Cause Analysis (RCA)

Isolation of originating service failure:
- Traverses directed dependency graph.
- Root cause: anomalous service whose direct dependencies are healthy.
- Blast radius computed via BFS traversal of caller nodes.
