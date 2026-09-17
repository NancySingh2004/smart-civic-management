"""
services/clustering.py

Feature 1 -- Common Civic Issue / Complaint Clustering.

Reuses the same grouping rule as the existing similar/duplicate detector
(same category + same location), but instead of just counting unresolved
similar complaints for priority scoring, this groups ALL complaints
(regardless of status) into "common civic issue" clusters so the admin can
see the full picture of a recurring problem -- without ever deleting or
merging the underlying complaint records.
"""

from models.complaint import SMART_PRIORITIES

_PRIORITY_RANK = {p: i for i, p in enumerate(SMART_PRIORITIES)}  # LOW=0 ... CRITICAL=3


def _highest_priority(priorities: list[str]) -> str:
    best = "LOW"
    for p in priorities:
        if _PRIORITY_RANK.get(p, 0) >= _PRIORITY_RANK.get(best, 0):
            best = p
    return best


def _representative_status(statuses: list[str]) -> str:
    """
    Pick a representative status for the cluster as a whole: the status
    that is "furthest along but not fully resolved" if any member is still
    open, otherwise RESOLVED if every member is resolved.
    """
    order = ["IN_PROGRESS", "ASSIGNED", "NEW"]
    for s in order:
        if s in statuses:
            return s
    return "RESOLVED" if statuses else "NEW"


async def build_common_issue_clusters(db, min_size: int = 2) -> list[dict]:
    """
    Group complaints by (category, location) and return clusters that have
    at least `min_size` reports -- this avoids flagging every single unique
    complaint as its own "cluster" (per the "avoid unnecessary duplicate
    clusters" requirement).
    """
    cursor = db["complaints"].find(
        {},
        {
            "complaint_id": 1,
            "category": 1,
            "location": 1,
            "status": 1,
            "smart_priority": 1,
            "assigned_department": 1,
            "created_at": 1,
            "_id": 0,
        },
    )
    docs = await cursor.to_list(length=5000)

    groups: dict[tuple, list[dict]] = {}
    for doc in docs:
        key = (doc.get("category"), doc.get("location"))
        groups.setdefault(key, []).append(doc)

    clusters = []
    for (category, location), members in groups.items():
        if len(members) < min_size:
            continue

        statuses = [m.get("status", "NEW") for m in members]
        priorities = [m.get("smart_priority", "LOW") for m in members]
        unresolved_ids = [m["complaint_id"] for m in members if m.get("status") != "RESOLVED"]
        departments = [m.get("assigned_department") for m in members if m.get("assigned_department")]
        representative_department = departments[0] if departments else None

        clusters.append({
            "cluster_id": f"{(category or '').lower()}::{(location or '').lower()}",
            "category": category,
            "location": location,
            "title": f"{category} near {location}",
            "total_reports": len(members),
            "unresolved_reports": len(unresolved_ids),
            "highest_priority": _highest_priority(priorities),
            "representative_status": _representative_status(statuses),
            "assigned_department": representative_department,
            "complaint_ids": sorted(m["complaint_id"] for m in members),
        })

    # Largest / most urgent clusters first
    clusters.sort(key=lambda c: (c["total_reports"], _PRIORITY_RANK.get(c["highest_priority"], 0)), reverse=True)
    return clusters
