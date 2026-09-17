"""
seed.py

Populates the `complaints` collection with 45 realistic, varied sample
complaints so the admin dashboard and analytics are meaningful out of the box.

Run with:
    python seed.py

This script:
    - Clears any existing complaints + counters (fresh seed each run)
    - Creates complaints across all categories, several locations, varied
      creation dates (so some are aging / SLA-breached), varied statuses,
      and deliberately repeats some (category, location) pairs so the
      similar-complaint detector and duplicate flags have real data to show.
"""

import asyncio
import os
import random
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from models.complaint import CATEGORY_DEPARTMENT_MAP, lookup_coordinates, cluster_key
from services.priority_engine import (
    category_score,
    age_score,
    similar_score,
    score_to_priority,
    to_priority_breakdown_response,
)

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "smart_civic_db")

LOCATIONS = [
    "MG Road", "Sector 12", "Gandhi Nagar", "Nehru Park", "Station Road",
    "Civil Lines", "Model Town", "Green Park Colony", "Lake View Colony",
    "Old City Market", "Ashok Vihar", "Rajendra Nagar", "Shastri Chowk",
    "Vivekanand Marg", "Ambedkar Road", "Gate 3, City Stadium",
]

CATEGORIES = ["Pothole", "Garbage", "Streetlight", "Water Supply", "Other"]

FEEDBACK_COMMENTS = [
    "Fixed quickly, thank you!",
    "Took a while but the work was done well.",
    "Officer kept me updated throughout, appreciated.",
    "Issue is resolved but came back a few days later.",
    "Great response time from the department.",
    None,
]

DESCRIPTIONS = {
    "Pothole": [
        "Large pothole has formed in the middle of the road, causing traffic to slow down and risking damage to vehicles.",
        "Deep pothole near the bus stop is filling with rainwater and is a hazard for two-wheelers at night.",
        "Multiple potholes have developed after recent rains, making the stretch difficult to drive on.",
    ],
    "Garbage": [
        "Garbage has not been collected for several days and is piling up near the roadside, causing a foul smell.",
        "Overflowing garbage bin is attracting stray animals and needs to be cleared urgently.",
        "Construction debris and household waste have been dumped illegally on the vacant plot.",
    ],
    "Streetlight": [
        "Streetlight has not been working for almost a week and the road gets extremely dark at night.",
        "Several streetlights in a row are non-functional, making the area unsafe for pedestrians after sunset.",
        "Streetlight pole is flickering continuously and may need an electrical inspection.",
    ],
    "Water Supply": [
        "No water supply has been received for the past three days despite the scheduled timing.",
        "Water pipeline leakage is causing wastage and flooding a section of the street.",
        "Supplied water appears discolored and residents are concerned about contamination.",
    ],
    "Other": [
        "A large tree branch has fallen across the footpath and is blocking pedestrian movement.",
        "Public park bench and fencing have been damaged and need repair.",
        "Stray dog menace has increased in the residential area, residents are concerned for safety.",
    ],
}

STATUS_FLOW = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]


def now_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]

    print(f"[seed] Connecting to {MONGODB_DB_NAME} ...")
    await db["complaints"].delete_many({})
    await db["counters"].delete_many({})
    print("[seed] Cleared existing complaints and counters.")

    now = datetime.now(timezone.utc)
    complaints_to_insert = []

    # Track (category, location) usage so we can deliberately create clusters
    # of similar unresolved complaints for the duplicate detector, the Common
    # Civic Issue clustering feature, and (for the largest cluster) automatic
    # escalation via "very high number of similar complaints" to have real
    # data to show.
    cluster_pairs = [
        ("Pothole", "MG Road", 9),           # deliberately large: demonstrates
                                              # clustering + the "very high
                                              # similar complaint count" escalation trigger
        ("Garbage", "Old City Market", 5),
        ("Streetlight", "Gate 3, City Stadium", 4),
        ("Water Supply", "Sector 12", 6),    # also large enough to breach SLA + escalate
    ]

    seq = 1000
    total_target = 45

    def next_id():
        nonlocal seq
        seq += 1
        return f"CMP-{seq}"

    # --- Step 1: Seed cluster complaints (multiple similar unresolved ones) ---
    for category, location, cluster_size in cluster_pairs:
        for i in range(cluster_size):
            age_days_choice = random.choice([1, 3, 4, 6, 8, 10, 12])
            created_dt = now - timedelta(days=age_days_choice, hours=random.randint(0, 23))
            complaints_to_insert.append({
                "category": category,
                "location": location,
                "created_dt": created_dt,
                "force_unresolved": True,
            })

    # --- Step 2: Fill the remaining with varied, mostly unique complaints ---
    while len(complaints_to_insert) < total_target:
        category = random.choice(CATEGORIES)
        location = random.choice(LOCATIONS)
        age_days_choice = random.choice([0, 1, 2, 3, 4, 5, 6, 7, 9, 12, 15])
        created_dt = now - timedelta(days=age_days_choice, hours=random.randint(0, 23))
        complaints_to_insert.append({
            "category": category,
            "location": location,
            "created_dt": created_dt,
            "force_unresolved": False,
        })

    random.shuffle(complaints_to_insert)

    # Running similar-complaint counter per (category, location) as we insert,
    # mimicking how the real API would see it at creation time.
    similar_running = {}

    inserted_docs = []

    for i, item in enumerate(complaints_to_insert):
        category = item["category"]
        location = item["location"]
        created_dt = item["created_dt"]
        created_iso = now_iso(created_dt)

        key = (category, location)
        similar_count_at_creation = similar_running.get(key, 0)
        similar_running[key] = similar_count_at_creation + 1

        age_days_at_creation = 0  # complaints are always NEW at age 0 when created
        c_score = category_score(category)
        a_score_creation = age_score(age_days_at_creation)
        s_score = similar_score(similar_count_at_creation)
        score_at_creation = c_score + a_score_creation + s_score
        smart_priority = score_to_priority(score_at_creation)

        complaint_id = next_id()

        # Decide final status: force_unresolved clusters stay NEW/ASSIGNED/IN_PROGRESS
        if item["force_unresolved"]:
            status = random.choices(
                ["NEW", "ASSIGNED", "IN_PROGRESS"], weights=[0.5, 0.3, 0.2]
            )[0]
        else:
            status = random.choices(STATUS_FLOW, weights=[0.25, 0.2, 0.2, 0.35])[0]

        status_history = [{
            "status": "NEW",
            "changed_by": "System",
            "note": "Complaint submitted by citizen.",
            "changed_at": created_iso,
        }]
        comments = []
        assigned_department = None
        resolved_at = None
        updated_dt = created_dt

        department = CATEGORY_DEPARTMENT_MAP[category]

        if status in ("ASSIGNED", "IN_PROGRESS", "RESOLVED"):
            assign_dt = created_dt + timedelta(hours=random.randint(2, 20))
            assigned_department = department
            status_history.append({
                "status": "ASSIGNED",
                "changed_by": "Admin",
                "note": f"Assigned to {department}.",
                "changed_at": now_iso(assign_dt),
            })
            comments.append({
                "author": "Admin",
                "message": f"Complaint assigned to {department}.",
                "created_at": now_iso(assign_dt),
            })
            updated_dt = assign_dt

        if status in ("IN_PROGRESS", "RESOLVED"):
            progress_dt = updated_dt + timedelta(hours=random.randint(4, 30))
            status_history.append({
                "status": "IN_PROGRESS",
                "changed_by": "Officer",
                "note": "Inspection scheduled and work has begun.",
                "changed_at": now_iso(progress_dt),
            })
            comments.append({
                "author": "Officer",
                "message": "Inspection scheduled.",
                "created_at": now_iso(progress_dt),
            })
            updated_dt = progress_dt

        if status == "RESOLVED":
            resolve_dt = updated_dt + timedelta(hours=random.randint(6, 96))
            status_history.append({
                "status": "RESOLVED",
                "changed_by": "Officer",
                "note": "Issue has been resolved.",
                "changed_at": now_iso(resolve_dt),
            })
            comments.append({
                "author": "Officer",
                "message": "Issue resolved and verified on-site.",
                "created_at": now_iso(resolve_dt),
            })
            resolved_at = now_iso(resolve_dt)
            updated_dt = resolve_dt

        doc = {
            "complaint_id": complaint_id,
            "category": category,
            "category_source": random.choice(["ai", "ai", "fallback"]),
            "description": random.choice(DESCRIPTIONS[category]),
            "location": location,
            "smart_priority": smart_priority,
            "priority_score": score_at_creation,
            "status": status,
            "assigned_department": assigned_department,
            "created_at": created_iso,
            "updated_at": now_iso(updated_dt),
            "resolved_at": resolved_at,
            "comments": comments,
            "status_history": status_history,
            "image_filename": None,
            "image_url": None,
            "feedback": None,
        }

        if status == "RESOLVED" and random.random() < 0.6:
            feedback_dt = updated_dt + timedelta(hours=random.randint(1, 48))
            doc["feedback"] = {
                "rating": random.choices([5, 4, 3, 2, 1], weights=[0.4, 0.3, 0.15, 0.1, 0.05])[0],
                "comment": random.choice(FEEDBACK_COMMENTS),
                "submitted_at": now_iso(feedback_dt),
            }

        # Every 5th complaint is deliberately seeded WITHOUT any of the newer
        # optional fields (latitude/longitude, cluster_id, priority_breakdown,
        # escalation fields) to simulate "legacy" documents that existed
        # before these features were added -- this is exactly the
        # backward-compatibility scenario the app needs to handle gracefully.
        is_legacy_style = (i % 5 == 4)

        if not is_legacy_style:
            latitude, longitude = lookup_coordinates(location)
            breakdown = {
                "category_score": c_score,
                "age_score": a_score_creation,
                "similar_score": s_score,
                "priority_score": score_at_creation,
                "smart_priority": smart_priority,
                "age_days": age_days_at_creation,
            }
            doc.update({
                "priority_breakdown": to_priority_breakdown_response(breakdown),
                "latitude": latitude,
                "longitude": longitude,
                "cluster_id": cluster_key(category, location),
                "is_escalated": False,
                "escalation_reason": None,
                "escalated_at": None,
                "escalation_level": None,
            })

        inserted_docs.append(doc)

    await db["complaints"].insert_many(inserted_docs)
    await db["counters"].update_one(
        {"_id": "complaint_id"}, {"$set": {"seq": seq - 1000}}, upsert=True
    )

    # Ensure indexes exist too
    await db["complaints"].create_index("complaint_id", unique=True)
    await db["complaints"].create_index("status")
    await db["complaints"].create_index("category")
    await db["complaints"].create_index([("category", 1), ("location", 1), ("status", 1)])

    print(f"[seed] Inserted {len(inserted_docs)} sample complaints.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
