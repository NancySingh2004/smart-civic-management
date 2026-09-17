"""
database.py

Handles the MongoDB Atlas connection using Motor (async MongoDB driver).
Exposes a single `db` object used across the app, plus helper functions
to connect/disconnect and to ensure useful indexes exist.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "smart_civic_db")

client: AsyncIOMotorClient | None = None
db = None


def get_database():
    """Return the active database instance (used by routes/services)."""
    global db
    return db


async def connect_to_mongo():
    """Initialize the MongoDB client and database, and create indexes."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    await ensure_indexes()
    print(f"[database] Connected to MongoDB database: {MONGODB_DB_NAME}")


async def close_mongo_connection():
    """Close the MongoDB client connection on app shutdown."""
    global client
    if client:
        client.close()
        print("[database] MongoDB connection closed.")


async def ensure_indexes():
    """
    Create useful indexes on the complaints collection.
    Safe to call multiple times (create_index is idempotent).
    """
    complaints = db["complaints"]
    await complaints.create_index("complaint_id", unique=True)
    await complaints.create_index("status")
    await complaints.create_index("category")
    await complaints.create_index("smart_priority")
    await complaints.create_index("location")
    await complaints.create_index("created_at")
    # Compound index used heavily by the duplicate/similar-complaint detector
    await complaints.create_index([("category", 1), ("location", 1), ("status", 1)])
