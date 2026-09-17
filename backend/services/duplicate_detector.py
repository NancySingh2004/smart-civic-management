"""
services/duplicate_detector.py

Detects "similar" complaints using a deliberately simple rule:
same category + same location + status != RESOLVED.

This count feeds directly into the rule-based prioritization engine,
and is also surfaced on the complaint detail page as "Similar Complaints: X".
"""


async def count_similar_complaints(db, category: str, location: str, exclude_complaint_id: str | None = None) -> int:
    """
    Count unresolved complaints that share the same category and location.
    `exclude_complaint_id` lets us exclude the complaint itself when
    recalculating similarity for an existing complaint.
    """
    query = {
        "category": category,
        "location": location,
        "status": {"$ne": "RESOLVED"},
    }
    if exclude_complaint_id:
        query["complaint_id"] = {"$ne": exclude_complaint_id}

    count = await db["complaints"].count_documents(query)
    return count


def is_potential_duplicate(similar_count: int) -> bool:
    """A complaint is flagged as a potential duplicate if 3+ similar complaints exist."""
    return similar_count >= 3


async def count_cluster_total(db, category: str, location: str) -> int:
    """
    Count ALL complaints (any status, including RESOLVED) sharing the same
    category and location. Used by the Common Civic Issue Clustering feature,
    which reports the full historical volume of a recurring issue rather than
    just the currently-unresolved similar-complaint count used for priority
    scoring.
    """
    return await db["complaints"].count_documents({"category": category, "location": location})
