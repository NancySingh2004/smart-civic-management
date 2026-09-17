"""
models/complaint.py

Defines the domain-level constants (categories, statuses, priorities,
departments) and the shape of a complaint document as stored in MongoDB.
This is intentionally plain-dict based (Motor works with dicts directly);
Pydantic validation lives in schemas/complaint.py.
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional


CATEGORIES = ["Pothole", "Garbage", "Streetlight", "Water Supply", "Other"]

SMART_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]

DEPARTMENTS = [
    "Road Maintenance Department",
    "Sanitation Department",
    "Electrical Department",
    "Water Supply Department",
]

# Category -> department suggestion (used as a sensible default when assigning)
CATEGORY_DEPARTMENT_MAP = {
    "Pothole": "Road Maintenance Department",
    "Garbage": "Sanitation Department",
    "Streetlight": "Electrical Department",
    "Water Supply": "Water Supply Department",
    "Other": "Road Maintenance Department",
}

# Valid forward status transitions. NEW -> RESOLVED directly is NOT allowed.
VALID_TRANSITIONS = {
    "NEW": ["ASSIGNED"],
    "ASSIGNED": ["IN_PROGRESS"],
    "IN_PROGRESS": ["RESOLVED"],
    "RESOLVED": [],
}

# SLA limits in days, keyed by smart_priority
SLA_LIMITS_DAYS = {
    "LOW": 7,
    "MEDIUM": 5,
    "HIGH": 3,
    "CRITICAL": 1,
}

# ---------------------------------------------------------------------------
# Location -> coordinates lookup (Feature: Location Intelligence).
# A fixed set of known location names (used by the seed data / demo) map to
# their real coordinates. Any other location -- which is every real citizen
# submission, since the form takes free text -- gets a *deterministic*
# pseudo-coordinate instead of being dropped: the location string is hashed
# to a stable point inside the city's bounding box, so the same location text
# always lands at the same spot and every complaint can be plotted on the
# map without depending on an external geocoding service or API key.
# ---------------------------------------------------------------------------
LOCATION_COORDINATES = {
    "mg road": (28.6139, 77.2090),
    "sector 12": (28.6304, 77.2177),
    "gandhi nagar": (28.6700, 77.3100),
    "nehru park": (28.5900, 77.1900),
    "station road": (28.6448, 77.2167),
    "civil lines": (28.6780, 77.2210),
    "model town": (28.7100, 77.1900),
    "green park colony": (28.5600, 77.2050),
    "lake view colony": (28.5500, 77.2400),
    "old city market": (28.6510, 77.2320),
    "shastri chowk": (28.6400, 77.2500),
    "vivekanand marg": (28.6200, 77.2600),
    "ambedkar road": (28.6600, 77.2050),
    "gate 3, city stadium": (28.6100, 77.2300),
}

# Bounding box used to scatter unrecognized locations -- roughly matches the
# spread of the known coordinates above.
_CITY_LAT_RANGE = (28.55, 28.71)
_CITY_LNG_RANGE = (77.18, 77.32)


def _pseudo_coordinates(key: str) -> tuple[float, float]:
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    lat_frac = int(digest[:8], 16) / 0xFFFFFFFF
    lng_frac = int(digest[8:16], 16) / 0xFFFFFFFF
    lat = _CITY_LAT_RANGE[0] + lat_frac * (_CITY_LAT_RANGE[1] - _CITY_LAT_RANGE[0])
    lng = _CITY_LNG_RANGE[0] + lng_frac * (_CITY_LNG_RANGE[1] - _CITY_LNG_RANGE[0])
    return round(lat, 4), round(lng, 4)


def lookup_coordinates(location: str):
    """
    Location -> (latitude, longitude). Never returns (None, None) for a
    non-empty location -- known locations get their real coordinates,
    everything else gets a stable pseudo-coordinate (see above) so the
    Location Intelligence map always has something to plot.
    """
    if not location:
        return None, None
    key = location.strip().lower()
    coords = LOCATION_COORDINATES.get(key)
    if coords:
        return coords
    return _pseudo_coordinates(key)


def cluster_key(category: str, location: str) -> str:
    """
    Deterministic identifier for a "Common Civic Issue" cluster: complaints
    sharing the same category and (normalized) location belong to the same
    cluster. This is intentionally the same grouping rule already used by
    the similar/duplicate complaint detector.
    """
    normalized_location = (location or "").strip().lower()
    normalized_category = (category or "").strip().lower()
    return f"{normalized_category}::{normalized_location}"


def now_iso() -> str:
    """Current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def build_complaint_document(
    complaint_id: str,
    category: str,
    description: str,
    location: str,
    smart_priority: str,
    priority_score: int,
    priority_breakdown: Optional[dict] = None,
    category_source: Optional[str] = None,
    image_filename: Optional[str] = None,
    image_url: Optional[str] = None,
) -> dict:
    """
    Build a new complaint document ready for insertion into MongoDB.

    New optional fields (latitude/longitude, cluster_id, escalation fields,
    priority_breakdown, image, feedback) are all populated with safe defaults
    so every complaint document has a consistent shape. None of these fields
    are required for the app to function -- older documents inserted before
    these fields existed are handled with `.get(field, default)` everywhere
    they're read, so they keep working unchanged.

    Category and priority are never chosen by the citizen: `category` is
    whatever the AI (or the offline keyword fallback) detected from the free
    text description, and `smart_priority` always comes from the rule-based
    priority engine.
    """
    timestamp = now_iso()
    latitude, longitude = lookup_coordinates(location)

    return {
        "complaint_id": complaint_id,
        "category": category,
        "category_source": category_source,
        "description": description,
        "location": location,
        "smart_priority": smart_priority,
        "priority_score": priority_score,
        "priority_breakdown": priority_breakdown,
        "status": "NEW",
        "assigned_department": None,
        "created_at": timestamp,
        "updated_at": timestamp,
        "resolved_at": None,
        "comments": [],
        "status_history": [
            {
                "status": "NEW",
                "changed_by": "System",
                "note": "Complaint submitted by citizen.",
                "changed_at": timestamp,
            }
        ],
        # --- Location Intelligence (Feature 2) ---
        "latitude": latitude,
        "longitude": longitude,
        # --- Common Civic Issue Clustering (Feature 1) ---
        "cluster_id": cluster_key(category, location),
        # --- Automatic SLA Escalation (Feature 3) ---
        "is_escalated": False,
        "escalation_reason": None,
        "escalated_at": None,
        "escalation_level": None,
        # --- Photo attachment ---
        "image_filename": image_filename,
        "image_url": image_url,
        # --- Citizen feedback (submitted after resolution) ---
        "feedback": None,
    }
