"""
schemas/complaint.py

Pydantic models used for request validation and response serialization.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator

from models.complaint import DEPARTMENTS, STATUSES


def validate_complaint_description(description: str) -> str:
    """
    Complaints are submitted as multipart form data (to support an optional
    image), so this validates the `description` field manually instead of
    through a pydantic request-body model.
    """
    v = (description or "").strip()
    if len(v) < 10:
        raise ValueError("Please describe the issue in at least 10 characters.")
    if len(v) > 2000:
        raise ValueError("Description must be at most 2000 characters.")
    return v


def validate_complaint_location(location: str) -> str:
    v = (location or "").strip()
    if len(v) < 2:
        raise ValueError("Please provide a location.")
    if len(v) > 200:
        raise ValueError("Location must be at most 200 characters.")
    return v


class AssignDepartmentRequest(BaseModel):
    department: str
    assigned_by: str = "Admin"

    @field_validator("department")
    @classmethod
    def validate_department(cls, v):
        if v not in DEPARTMENTS:
            raise ValueError(f"department must be one of {DEPARTMENTS}")
        return v


class StatusUpdateRequest(BaseModel):
    status: str
    changed_by: str = "Admin"
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in STATUSES:
            raise ValueError(f"status must be one of {STATUSES}")
        return v


class CommentCreate(BaseModel):
    author: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1, max_length=1000)


class FeedbackCreate(BaseModel):
    """Citizen satisfaction feedback, only accepted once a complaint is RESOLVED."""
    rating: int = Field(..., ge=1, le=5, description="1 (very dissatisfied) to 5 (very satisfied)")
    comment: Optional[str] = Field(None, max_length=1000)
