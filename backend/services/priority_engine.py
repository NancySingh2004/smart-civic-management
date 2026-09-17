"""
services/priority_engine.py

Implements the mandatory rule-based prioritization engine:

    Priority Score = Category Score + Age Score + Similar Complaint Score

Category Score:
    Water Supply = 3, Streetlight = 2, Pothole = 2, Garbage = 1, Other = 1

Age Score:
    < 2 days = 1, 2-5 days = 2, > 5 days = 3

Similar Complaint Score:
    0-2 similar = 1, 3-5 similar = 2, > 5 similar = 3

Final mapping:
    3-4 = LOW, 5-6 = MEDIUM, 7-8 = HIGH, 9 = CRITICAL
"""

from datetime import datetime, timezone

CATEGORY_SCORES = {
    "Water Supply": 3,
    "Streetlight": 2,
    "Pothole": 2,
    "Garbage": 1,
    "Other": 1,
}


def _parse_iso(dt_str: str) -> datetime:
    dt = datetime.fromisoformat(dt_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def calculate_age_in_days(created_at: str, reference_time: datetime | None = None) -> int:
    """Number of whole days between created_at and now (or a reference time)."""
    created_dt = _parse_iso(created_at)
    ref = reference_time or datetime.now(timezone.utc)
    delta = ref - created_dt
    return max(delta.days, 0)


def category_score(category: str) -> int:
    return CATEGORY_SCORES.get(category, 1)


def age_score(age_days: int) -> int:
    if age_days < 2:
        return 1
    elif 2 <= age_days <= 5:
        return 2
    else:
        return 3


def similar_score(similar_count: int) -> int:
    if similar_count <= 2:
        return 1
    elif 3 <= similar_count <= 5:
        return 2
    else:
        return 3


def score_to_priority(score: int) -> str:
    if score <= 4:
        return "LOW"
    elif score <= 6:
        return "MEDIUM"
    elif score <= 8:
        return "HIGH"
    else:
        return "CRITICAL"


def calculate_smart_priority(category: str, created_at: str, similar_count: int) -> dict:
    """
    Compute the full smart priority breakdown for a complaint.
    Returns a dict with the individual scores, the final score, and the
    resulting smart_priority label.
    """
    age_days = calculate_age_in_days(created_at)
    c_score = category_score(category)
    a_score = age_score(age_days)
    s_score = similar_score(similar_count)
    total = c_score + a_score + s_score
    priority = score_to_priority(total)

    return {
        "category_score": c_score,
        "age_score": a_score,
        "similar_score": s_score,
        "priority_score": total,
        "smart_priority": priority,
        "age_days": age_days,
    }


def to_priority_breakdown_response(breakdown: dict) -> dict:
    """
    Adapt the internal breakdown dict (from calculate_smart_priority) into the
    explainable-priority API shape used by the frontend:

        {
          "category_score": ...,
          "age_score": ...,
          "similar_complaints_score": ...
        }

    This exists purely to expose the *existing* scoring logic without
    renaming its internal keys everywhere else in the codebase.
    """
    return {
        "category_score": breakdown["category_score"],
        "age_score": breakdown["age_score"],
        "similar_complaints_score": breakdown["similar_score"],
    }
