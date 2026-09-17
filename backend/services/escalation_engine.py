"""
services/escalation_engine.py

Feature 3 -- Automatic SLA Escalation.

This is a pure, read-time evaluation of whether a complaint should be
escalated, layered entirely on top of the existing SLA/priority logic.
It does NOT touch the NEW -> ASSIGNED -> IN_PROGRESS -> RESOLVED workflow --
escalation is a separate, informational flag that admins can filter/sort by.

`evaluate_escalation` is a pure function (no DB access) so it can be reused
consistently by the complaint detail endpoint, the complaint list endpoint,
and the analytics dashboard.

`sync_escalation_state` is a thin persistence helper: whenever a complaint is
read, we recompute its escalation status and -- only if it changed -- persist
it, so `escalated_at` reflects the first time the complaint was actually
detected as escalated, without needing a background cron job.
"""

from models.complaint import SLA_LIMITS_DAYS, now_iso

VERY_OLD_THRESHOLD_DAYS = 10
HIGH_PRIORITY_STUCK_DAYS = 2
CRITICAL_PRIORITY_STUCK_DAYS = 1
HIGH_SIMILAR_COUNT_THRESHOLD = 5


def evaluate_escalation(status: str, smart_priority: str, age_days: int, similar_count: int) -> dict:
    """
    Determine whether a complaint should be escalated right now, and why.
    Resolved complaints are never escalated (the issue is already fixed).
    """
    if status == "RESOLVED":
        return {"is_escalated": False, "escalation_reason": None, "escalation_level": None}

    reasons = []
    sla_limit = SLA_LIMITS_DAYS.get(smart_priority, 7)

    if age_days >= sla_limit:
        reasons.append(f"SLA breached ({age_days}d elapsed vs {sla_limit}d limit for {smart_priority} priority)")

    if age_days > VERY_OLD_THRESHOLD_DAYS:
        reasons.append(f"Complaint is extremely old ({age_days} days unresolved)")

    if smart_priority == "CRITICAL" and age_days >= CRITICAL_PRIORITY_STUCK_DAYS:
        reasons.append("CRITICAL priority complaint has remained open too long")
    elif smart_priority == "HIGH" and age_days >= HIGH_PRIORITY_STUCK_DAYS:
        reasons.append("HIGH priority complaint has remained open too long")

    if similar_count > HIGH_SIMILAR_COUNT_THRESHOLD:
        reasons.append(f"Very high number of similar unresolved complaints ({similar_count})")

    if not reasons:
        return {"is_escalated": False, "escalation_reason": None, "escalation_level": None}

    escalation_level = "LEVEL_2" if len(reasons) >= 3 else "LEVEL_1"

    return {
        "is_escalated": True,
        "escalation_reason": "; ".join(reasons),
        "escalation_level": escalation_level,
    }


async def sync_escalation_state(db, doc: dict, age_days: int, similar_count: int) -> dict:
    """
    Recompute escalation for `doc` and persist the change if the escalation
    status flipped. Mutates and returns `doc` (already-serialized dict) with
    the up-to-date escalation fields so the caller can return it directly.
    """
    result = evaluate_escalation(
        status=doc.get("status", "NEW"),
        smart_priority=doc.get("smart_priority", "LOW"),
        age_days=age_days,
        similar_count=similar_count,
    )

    was_escalated = bool(doc.get("is_escalated", False))
    now_escalated = result["is_escalated"]

    update_fields = {}
    if now_escalated and not was_escalated:
        update_fields = {
            "is_escalated": True,
            "escalation_reason": result["escalation_reason"],
            "escalation_level": result["escalation_level"],
            "escalated_at": now_iso(),
        }
    elif now_escalated and was_escalated:
        if (
            result["escalation_reason"] != doc.get("escalation_reason")
            or result["escalation_level"] != doc.get("escalation_level")
        ):
            update_fields = {
                "escalation_reason": result["escalation_reason"],
                "escalation_level": result["escalation_level"],
            }
    elif not now_escalated and was_escalated:
        update_fields = {
            "is_escalated": False,
            "escalation_reason": None,
            "escalation_level": None,
            "escalated_at": None,
        }

    if update_fields:
        await db["complaints"].update_one({"complaint_id": doc["complaint_id"]}, {"$set": update_fields})
        doc.update(update_fields)
    else:
        doc.setdefault("is_escalated", result["is_escalated"])
        doc.setdefault("escalation_reason", result["escalation_reason"])
        doc.setdefault("escalation_level", result["escalation_level"])

    return doc
