"""
AstraSRE — Root Cause Analysis Engine
Topological traversal of the service dependency graph
to isolate the originating failure service.
"""

# Directed graph: key depends on values
# Read as: "frontend calls order", "order calls inventory + notification", etc.
DEPENDENCY_GRAPH: dict[str, list[str]] = {
    "frontend":     ["order"],
    "order":        ["inventory", "notification"],
    "inventory":    ["payment"],
    "payment":      [],
    "notification": [],
}


def find_root_cause(anomaly_scores: dict) -> dict | None:
    """
    Root cause = anomalous service whose *dependencies* are NOT anomalous.
    (i.e. the anomaly originated here, not propagated from upstream)

    Args:
        anomaly_scores: output of AnomalyDetector.predict()

    Returns:
        { service, score, severity, confidence, affected, blast_radius }
        or None if no anomalies.
    """
    anomalous = {
        svc for svc, data in anomaly_scores.items()
        if data.get("is_anomaly")
    }
    if not anomalous:
        return None

    root_causes = []
    for service in anomalous:
        # Who does this service call? If they're fine, this IS the root.
        deps = DEPENDENCY_GRAPH.get(service, [])
        dep_anomalous = any(d in anomalous for d in deps)
        if not dep_anomalous:
            root_causes.append({
                "service":      service,
                "score":        anomaly_scores[service]["score"],
                "severity":     anomaly_scores[service]["severity"],
                "confidence":   anomaly_scores[service].get("confidence", 1.0),
                "affected":     [s for s in anomalous if s != service],
                "blast_radius": get_blast_radius(service),
            })

    if not root_causes:
        # All anomalous services have anomalous deps — pick highest score
        svc = max(anomalous, key=lambda s: anomaly_scores[s]["score"])
        root_causes = [{
            "service":      svc,
            "score":        anomaly_scores[svc]["score"],
            "severity":     anomaly_scores[svc]["severity"],
            "confidence":   anomaly_scores[svc].get("confidence", 1.0),
            "affected":     [s for s in anomalous if s != svc],
            "blast_radius": get_blast_radius(svc),
        }]

    root_causes.sort(key=lambda x: x["score"], reverse=True)
    return root_causes[0]


def get_blast_radius(service: str) -> list[str]:
    """Finds all downstream services affected by the failure of the specified service.

    Uses Breadth-First Search (BFS) to traverse the dependency graph.

    Args:
        service: The root service identifier that failed.

    Returns:
        A list of impacted service names.
    """
    affected = []
    queue = [service]
    visited: set[str] = set()
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        # Who calls `current`?
        callers = [s for s, deps in DEPENDENCY_GRAPH.items() if current in deps]
        affected.extend(callers)
        queue.extend(callers)
    return list(set(affected))


def explain_graph() -> dict[str, list[str]]:
    """Returns the full static dependency graph for dashboard visualization."""
    return DEPENDENCY_GRAPH
