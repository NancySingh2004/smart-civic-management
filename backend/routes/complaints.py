"""
routes/complaints.py

All complaint-related endpoints:
    POST   /complaints
    GET    /complaints
    GET    /complaints/{complaint_id}
    PUT    /complaints/{complaint_id}/assign
    PUT    /complaints/{complaint_id}/status
    POST   /complaints/{complaint_id}/comments
    POST   /complaints/{complaint_id}/feedback
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Form, File, UploadFile
from typing import Optional

from database import get_database
from models.complaint import (
    build_complaint_document,
    now_iso,
    VALID_TRANSITIONS,
    CATEGORY_DEPARTMENT_MAP,
    cluster_key,
)
from schemas.complaint import (
    AssignDepartmentRequest,
    StatusUpdateRequest,
    CommentCreate,
    FeedbackCreate,
    validate_complaint_description,
    validate_complaint_location,
)
from services.priority_engine import (
    calculate_smart_priority,
    calculate_age_in_days,
    to_priority_breakdown_response,
)
from services.duplicate_detector import (
    count_similar_complaints,
    is_potential_duplicate,
    count_cluster_total,
)
from services.escalation_engine import sync_escalation_state
from services.ai_analyzer import detect_category_and_priority

router = APIRouter(prefix="/complaints", tags=["Complaints"])

# --- Photo attachment storage -----------------------------------------------
# Complaints may optionally include one photo. Stored on local disk and
# served back via the /uploads static mount (see main.py) -- simple and
# dependency-free, matching the rest of this codebase's "no external
# services required to run" philosophy.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


async def save_complaint_image(image: UploadFile) -> tuple[str, str]:
    """Validate and persist an uploaded complaint photo. Returns (filename, url)."""
    ext = ALLOWED_IMAGE_TYPES.get(image.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Image must be a JPEG, PNG, or WEBP file.")

    content = await image.read()
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5MB.")

    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return filename, f"/uploads/{filename}"


def serialize_complaint(doc: dict) -> dict:
    """Strip Mongo's internal _id so the document is JSON-serializable."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


async def get_next_complaint_id(db) -> str:
    """
    Atomically increment a counter document to generate sequential,
    human-friendly complaint IDs like CMP-1001, CMP-1002, ...
    """
    counters = db["counters"]
    result = await counters.find_one_and_update(
        {"_id": "complaint_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result["seq"] if result and "seq" in result else 1
    # Ensure a stable starting point even on first ever run
    if seq < 1:
        seq = 1
    return f"CMP-{1000 + seq}"


@router.post("", status_code=201)
async def create_complaint(
    description: str = Form(...),
    location: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    """
    Citizens only ever provide a description, a location, and (optionally) a
    photo -- there is no category or priority picker. Category is detected
    automatically (AI, with an offline keyword fallback) and priority is
    always computed by the rule-based smart priority engine.
    """
    try:
        description = validate_complaint_description(description)
        location = validate_complaint_location(location)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    db = get_database()

    detected = await detect_category_and_priority(description)
    category = detected["category"]

    image_filename, image_url = (None, None)
    if image is not None and image.filename:
        image_filename, image_url = await save_complaint_image(image)

    complaint_id = await get_next_complaint_id(db)

    # Count similar complaints BEFORE inserting this one (so it doesn't count itself)
    similar_count = await count_similar_complaints(db, category, location)

    # Smart priority uses age=0 at creation time
    breakdown = calculate_smart_priority(
        category=category,
        created_at=now_iso(),
        similar_count=similar_count,
    )

    doc = build_complaint_document(
        complaint_id=complaint_id,
        category=category,
        description=description,
        location=location,
        smart_priority=breakdown["smart_priority"],
        priority_score=breakdown["priority_score"],
        priority_breakdown=to_priority_breakdown_response(breakdown),
        category_source=detected["source"],
        image_filename=image_filename,
        image_url=image_url,
    )

    await db["complaints"].insert_one(doc)
    return serialize_complaint(doc)


@router.get("")
async def list_complaints(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None, description="Filter by smart_priority"),
    search: Optional[str] = Query(None, description="Search complaint_id, description, location"),
    location: Optional[str] = Query(None, description="Filter by exact location (used by cluster drill-down)"),
    escalated: Optional[str] = Query(None, description="'true' or 'false' to filter by escalation status"),
):
    db = get_database()
    query: dict = {}

    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if priority:
        query["smart_priority"] = priority
    if location:
        query["location"] = location
    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"complaint_id": regex},
            {"description": regex},
            {"location": regex},
        ]

    cursor = db["complaints"].find(query).sort("created_at", -1)
    results = await cursor.to_list(length=2000)

    complaints = []
    for doc in results:
        doc = serialize_complaint(doc)
        age_days = calculate_age_in_days(doc["created_at"])
        doc["age_days"] = age_days

        # Escalation is evaluated live and lazily persisted (Feature 3).
        similar_count_for_escalation = await count_similar_complaints(
            db, doc["category"], doc["location"], exclude_complaint_id=doc["complaint_id"]
        )
        doc = await sync_escalation_state(db, doc, age_days, similar_count_for_escalation)

        complaints.append(doc)

    if escalated == "true":
        complaints = [c for c in complaints if c.get("is_escalated")]
    elif escalated == "false":
        complaints = [c for c in complaints if not c.get("is_escalated")]

    return complaints


@router.get("/{complaint_id}")
async def get_complaint(complaint_id: str):
    db = get_database()
    doc = await db["complaints"].find_one({"complaint_id": complaint_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    doc = serialize_complaint(doc)
    similar_count = await count_similar_complaints(
        db, doc["category"], doc["location"], exclude_complaint_id=complaint_id
    )
    doc["similar_complaints"] = similar_count
    doc["potential_duplicate"] = is_potential_duplicate(similar_count)
    age_days = calculate_age_in_days(doc["created_at"])
    doc["age_days"] = age_days

    # --- Feature 4: Explainable Smart Priority ---
    # Recomputed live (using the current age & similar-complaint count) so the
    # breakdown shown always matches the actual current calculation, using the
    # exact same scoring rules as complaint creation.
    live_breakdown = calculate_smart_priority(
        category=doc["category"], created_at=doc["created_at"], similar_count=similar_count
    )
    doc["priority_breakdown"] = to_priority_breakdown_response(live_breakdown)

    # --- Feature 1: Common Civic Issue Clustering ---
    cluster_total = await count_cluster_total(db, doc["category"], doc["location"])
    doc["cluster_id"] = doc.get("cluster_id") or cluster_key(doc["category"], doc["location"])
    doc["cluster_size"] = cluster_total
    doc["is_common_issue"] = cluster_total >= 2

    # --- Feature 3: Automatic SLA Escalation ---
    doc = await sync_escalation_state(db, doc, age_days, similar_count)

    return doc


@router.put("/{complaint_id}/assign")
async def assign_complaint(complaint_id: str, payload: AssignDepartmentRequest):
    db = get_database()
    doc = await db["complaints"].find_one({"complaint_id": complaint_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    if doc["status"] == "RESOLVED":
        raise HTTPException(status_code=400, detail="Cannot reassign a resolved complaint")

    timestamp = now_iso()
    new_status = "ASSIGNED" if doc["status"] == "NEW" else doc["status"]

    history_entry = {
        "status": new_status,
        "changed_by": payload.assigned_by,
        "note": f"Assigned to {payload.department}.",
        "changed_at": timestamp,
    }

    update = {
        "$set": {
            "assigned_department": payload.department,
            "status": new_status,
            "updated_at": timestamp,
        },
        "$push": {
            "status_history": history_entry,
            "comments": {
                "author": payload.assigned_by,
                "message": f"Complaint assigned to {payload.department}.",
                "created_at": timestamp,
            },
        },
    }

    await db["complaints"].update_one({"complaint_id": complaint_id}, update)
    updated = await db["complaints"].find_one({"complaint_id": complaint_id})
    return serialize_complaint(updated)


@router.put("/{complaint_id}/status")
async def update_status(complaint_id: str, payload: StatusUpdateRequest):
    db = get_database()
    doc = await db["complaints"].find_one({"complaint_id": complaint_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    current_status = doc["status"]
    allowed_next = VALID_TRANSITIONS.get(current_status, [])

    if payload.status == current_status:
        raise HTTPException(status_code=400, detail=f"Complaint is already {current_status}")

    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} -> {payload.status}. "
            f"Allowed next status: {allowed_next or 'none (terminal state)'}",
        )

    if payload.status == "ASSIGNED" and not doc.get("assigned_department"):
        raise HTTPException(
            status_code=400,
            detail="Assign a department before moving the complaint to ASSIGNED",
        )

    timestamp = now_iso()
    history_entry = {
        "status": payload.status,
        "changed_by": payload.changed_by,
        "note": payload.note or f"Status changed to {payload.status}.",
        "changed_at": timestamp,
    }

    set_fields = {"status": payload.status, "updated_at": timestamp}
    if payload.status == "RESOLVED":
        set_fields["resolved_at"] = timestamp

    update = {
        "$set": set_fields,
        "$push": {
            "status_history": history_entry,
            "comments": {
                "author": payload.changed_by,
                "message": payload.note or f"Status changed to {payload.status}.",
                "created_at": timestamp,
            },
        },
    }

    await db["complaints"].update_one({"complaint_id": complaint_id}, update)
    updated = await db["complaints"].find_one({"complaint_id": complaint_id})
    return serialize_complaint(updated)


@router.post("/{complaint_id}/comments", status_code=201)
async def add_comment(complaint_id: str, payload: CommentCreate):
    db = get_database()
    doc = await db["complaints"].find_one({"complaint_id": complaint_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    timestamp = now_iso()
    comment = {
        "author": payload.author,
        "message": payload.message,
        "created_at": timestamp,
    }

    await db["complaints"].update_one(
        {"complaint_id": complaint_id},
        {"$push": {"comments": comment}, "$set": {"updated_at": timestamp}},
    )

    updated = await db["complaints"].find_one({"complaint_id": complaint_id})
    return serialize_complaint(updated)


@router.post("/{complaint_id}/feedback", status_code=201)
async def submit_feedback(complaint_id: str, payload: FeedbackCreate):
    """
    Citizens rate how their complaint was handled once it's RESOLVED --
    one submission per complaint, never overwritten.
    """
    db = get_database()
    doc = await db["complaints"].find_one({"complaint_id": complaint_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    if doc["status"] != "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Feedback can only be submitted after the complaint is resolved.",
        )

    if doc.get("feedback"):
        raise HTTPException(status_code=400, detail="Feedback has already been submitted for this complaint.")

    timestamp = now_iso()
    feedback = {
        "rating": payload.rating,
        "comment": payload.comment,
        "submitted_at": timestamp,
    }

    await db["complaints"].update_one(
        {"complaint_id": complaint_id},
        {"$set": {"feedback": feedback, "updated_at": timestamp}},
    )

    updated = await db["complaints"].find_one({"complaint_id": complaint_id})
    return serialize_complaint(updated)


@router.get("/meta/departments")
async def get_department_suggestions():
    """Helper endpoint the frontend can use to pre-fill a suggested department per category."""
    return CATEGORY_DEPARTMENT_MAP
