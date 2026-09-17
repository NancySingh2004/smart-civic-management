"""
main.py

FastAPI application entry point for the Smart Civic Complaint & Issue
Management System backend.
"""

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pathlib import Path
from dotenv import load_dotenv

from database import connect_to_mongo, close_mongo_connection
from routes import complaints, analytics

# Load backend/.env by explicit path so this works the same no matter what
# directory `uvicorn` is launched from (load_dotenv() with no argument only
# searches upward from the current working directory, which is fragile).
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

app = FastAPI(
    title="Smart Civic Complaint & Issue Management System",
    description="API for citizen complaint submission and municipal operations management.",
    version="1.0.0",
)

# ---- CORS ----
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Uploaded complaint photos ----
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---- Lifecycle events ----
@app.on_event("startup")
async def on_startup():
    await connect_to_mongo()


@app.on_event("shutdown")
async def on_shutdown():
    await close_mongo_connection()


# ---- Global error handling ----
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(loc) for loc in err["loc"][1:]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": "Validation error", "errors": errors})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"Internal server error: {str(exc)}"})


# ---- Routers ----
app.include_router(complaints.router)
app.include_router(analytics.router)


@app.get("/")
async def root():
    return {
        "service": "Smart Civic Complaint & Issue Management System API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}
