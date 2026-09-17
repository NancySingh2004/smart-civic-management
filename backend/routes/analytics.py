"""
routes/analytics.py

GET /analytics/dashboard

Aggregates everything the admin dashboard needs in a single call:
    - Summary cards
    - Issue distribution by category
    - Unresolved complaints
    - Aging complaints
    - High-priority locations
    - SLA performance (met / breached / at risk / within SLA)
"""

from datetime import datetime, timezone
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Query

from database import get_database
from models.complaint import CATEGORIES, SLA_LIMITS_DAYS
from services.priority_engine import calculate_age_in_days, _parse_iso
from services.escalation_engine import sync_escalation_state
from services.duplicate_detector import count_similar_complaints
from services.clustering import build_common_issue_clusters

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_analytics():
    db = get_database()
    cursor = db["complaints"].find({})
    complaints = await cursor.to_list(length=5000)

    total = len(complaints)
    status_counts = defaultdict(int)
    category_counts = defaultdict(int)
    high_priority_locations = defaultdict(int)

    unresolved_list = []
    aging_list = []
    escalated_list = []

    sla_met = 0
    sla_breached_resolved = 0
    sla_at_risk = 0
    sla_breached_unresolved = 0
    sla_within = 0
    escalated_count = 0

    now = datetime.now(timezone.utc)

    for doc in complaints:
        status = doc.get("status", "NEW")
        category = doc.get("category", "Other")
        smart_priority = doc.get("smart_priority", "LOW")
        location = doc.get("location", "Unknown")
        created_at = doc.get("created_at")

        status_counts[status] += 1
        category_counts[category] += 1

        age_days = calculate_age_in_days(created_at, now) if created_at else 0

        if smart_priority in ("HIGH", "CRITICAL"):
            high_priority_locations[location] += 1

        limit = SLA_LIMITS_DAYS.get(smart_priority, 7)

        if status == "RESOLVED":
            resolved_at = doc.get("resolved_at")
            if resolved_at:
                resolution_days = (_parse_iso(resolved_at) - _parse_iso(created_at)).days
                resolution_days = max(resolution_days, 0)
                if resolution_days <= limit:
                    sla_met += 1
                else:
                    sla_breached_resolved += 1
        else:
            unresolved_list.append(
                {
                    "complaint_id": doc.get("complaint_id"),
                    "category": category,
                    "location": location,
                    "status": status,
                    "smart_priority": smart_priority,
                    "age_days": age_days,
                }
            )

            if age_days >= limit:
                sla_breached_unresolved += 1
                sla_status = "SLA Breached"
            elif age_days >= limit * 0.7:
                sla_at_risk += 1
                sla_status = "At Risk"
            else:
                sla_within += 1
                sla_status = "Within SLA"

            aging_list.append(
                {
                    "complaint_id": doc.get("complaint_id"),
                    "category": category,
                    "location": location,
                    "age_days": age_days,
                    "status": status,
                    "smart_priority": smart_priority,
                    "sla_status": sla_status,
                }
            )

            # --- Feature 3: Automatic SLA Escalation ---
            # Evaluated + lazily persisted for every open complaint whenever
            # the dashboard loads, so escalation stays current automatically.
            similar_count = await count_similar_complaints(
                db, category, location, exclude_complaint_id=doc.get("complaint_id")
            )
            doc = await sync_escalation_state(db, doc, age_days, similar_count)
            if doc.get("is_escalated"):
                escalated_count += 1
                escalated_list.append(
                    {
                        "complaint_id": doc.get("complaint_id"),
                        "category": category,
                        "location": location,
                        "age_days": age_days,
                        "status": status,
                        "smart_priority": smart_priority,
                        "escalation_reason": doc.get("escalation_reason"),
                        "escalation_level": doc.get("escalation_level"),
                        "escalated_at": doc.get("escalated_at"),
                    }
                )

    # Sort aging complaints oldest-first, highlight top 10
    aging_list.sort(key=lambda c: c["age_days"], reverse=True)

    # Sort high-priority locations by count desc, top 10
    high_priority_location_list = [
        {"location": loc, "count": count}
        for loc, count in sorted(high_priority_locations.items(), key=lambda x: x[1], reverse=True)
    ][:10]

    issue_distribution = [
        {"category": cat, "count": category_counts.get(cat, 0)} for cat in CATEGORIES
    ]

    summary = {
        "total_complaints": total,
        "new_complaints": status_counts.get("NEW", 0),
        "assigned_complaints": status_counts.get("ASSIGNED", 0),
        "in_progress_complaints": status_counts.get("IN_PROGRESS", 0),
        "resolved_complaints": status_counts.get("RESOLVED", 0),
        "unresolved_complaints": total - status_counts.get("RESOLVED", 0),
        "sla_breached": sla_breached_resolved + sla_breached_unresolved,
        "escalated_complaints": escalated_count,
    }

    total_resolved = sla_met + sla_breached_resolved
    sla_performance = {
        "sla_met": sla_met,
        "sla_breached_resolved": sla_breached_resolved,
        "sla_met_percentage": round((sla_met / total_resolved) * 100, 1) if total_resolved else 0,
        "sla_at_risk": sla_at_risk,
        "sla_breached_unresolved": sla_breached_unresolved,
        "sla_within": sla_within,
    }

    escalated_list.sort(key=lambda c: c["age_days"], reverse=True)

    return {
        "summary": summary,
        "issue_distribution": issue_distribution,
        "unresolved_complaints": sorted(unresolved_list, key=lambda c: c["age_days"], reverse=True)[:20],
        "aging_complaints": aging_list[:15],
        "high_priority_locations": high_priority_location_list,
        "sla_performance": sla_performance,
        "escalated_complaints": escalated_list[:15],
    }


@router.get("/common-issues")
async def get_common_issues(min_size: int = Query(2, ge=2, le=50)):
    """
    Feature 1 -- Common Civic Issue / Complaint Clustering.
    Groups complaints sharing the same category + location into clusters,
    without ever deleting or merging the individual complaint records.
    """
    db = get_database()
    clusters = await build_common_issue_clusters(db, min_size=min_size)
    return {"clusters": clusters}


@router.get("/heatmap")
async def get_heatmap(
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None, description="Filter by smart_priority"),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date, inclusive"),
    date_to: Optional[str] = Query(None, description="ISO date, inclusive"),
):
    """
    Feature 2 -- Complaint Heatmap / Location Intelligence.
    Aggregates complaints per location for map plotting. Locations without
    coordinates (latitude/longitude is None) are returned separately as a
    fallback list rather than being silently dropped, so nothing breaks for
    complaints created before coordinates existed or for unrecognized
    locations.
    """
    db = get_database()
    query: dict = {}
    if category:
        query["category"] = category
    if priority:
        query["smart_priority"] = priority
    if status:
        query["status"] = status

    cursor = db["complaints"].find(query)
    complaints = await cursor.to_list(length=5000)

    if date_from or date_to:
        filtered = []
        for doc in complaints:
            created_at = doc.get("created_at")
            if not created_at:
                continue
            created_date = created_at[:10]  # ISO date prefix, safe string compare
            if date_from and created_date < date_from:
                continue
            if date_to and created_date > date_to:
                continue
            filtered.append(doc)
        complaints = filtered

    location_stats: dict[str, dict] = {}
    locations_without_coordinates: dict[str, dict] = {}

    for doc in complaints:
        location = doc.get("location", "Unknown")
        lat = doc.get("latitude")
        lng = doc.get("longitude")
        is_unresolved_high = doc.get("smart_priority") in ("HIGH", "CRITICAL") and doc.get("status") != "RESOLVED"

        bucket = location_stats if (lat is not None and lng is not None) else locations_without_coordinates
        entry = bucket.setdefault(
            location,
            {
                "location": location,
                "latitude": lat,
                "longitude": lng,
                "total_count": 0,
                "unresolved_count": 0,
                "high_or_critical_unresolved_count": 0,
                "categories": defaultdict(int),
            },
        )
        entry["total_count"] += 1
        if doc.get("status") != "RESOLVED":
            entry["unresolved_count"] += 1
        if is_unresolved_high:
            entry["high_or_critical_unresolved_count"] += 1
        entry["categories"][doc.get("category", "Other")] += 1

    def risk_level(entry: dict) -> str:
        if entry["high_or_critical_unresolved_count"] >= 3:
            return "high"
        if entry["high_or_critical_unresolved_count"] >= 1:
            return "medium"
        return "low"

    def finalize(entry: dict) -> dict:
        entry = dict(entry)
        entry["categories"] = dict(entry["categories"])
        entry["risk_level"] = risk_level(entry)
        return entry

    points = [finalize(e) for e in location_stats.values()]
    points.sort(key=lambda e: e["total_count"], reverse=True)

    fallback = [
        {"location": e["location"], "total_count": e["total_count"], "unresolved_count": e["unresolved_count"]}
        for e in locations_without_coordinates.values()
    ]
    fallback.sort(key=lambda e: e["total_count"], reverse=True)

    return {
        "points": points,
        "locations_without_coordinates": fallback,
    }
