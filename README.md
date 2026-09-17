# CivicConnect — Smart Civic Complaint & Issue Management System

A full-stack municipal operations platform that lets citizens report civic issues (potholes,
garbage, streetlights, water supply, etc.) and gives municipal staff a smart, transparent
workflow to triage, assign, and resolve them.

--- 

## New Advanced Features (v2)

Five features were added on top of the original system, without changing the existing complaint
workflow, tech stack, or data that already existed:

1. **Common Civic Issue Clustering** — complaints sharing a category + location are grouped
   (never merged or deleted) into a "Common Civic Issue" with a citizen-report count. See `/admin/common-issues`.
2. **Location Intelligence / Heatmap** — a dependency-free SVG risk map plus filters
   (category/priority/status/date range), with a graceful fallback list for locations without
   coordinates. See `/admin/location-intelligence`.
3. **Automatic SLA Escalation** — complaints are automatically flagged `is_escalated` based on
   SLA breach, extreme age, prolonged HIGH/CRITICAL priority, or very high similar-complaint
   volume — entirely separate from the NEW → ASSIGNED → IN PROGRESS → RESOLVED workflow.
4. **Explainable Smart Priority** — the complaint detail page shows a live "Why this priority?"
   breakdown table generated directly from the real scoring engine (category + age + similar
   complaints = total).
5. **AI Complaint Understanding (optional)** — an "✨ Analyze with AI" button on the citizen form
   extracts category/location/duration/urgency/summary from free text using Claude, with editable
   pre-filled fields and a safe manual-entry fallback if no `ANTHROPIC_API_KEY` is configured.

See `FEATURES_ADDED.md` for the full write-up (files changed, new APIs, DB fields, testing notes).

---

## Problem Statement

Municipal authorities receive hundreds of complaints about civic issues every week. Many are
incomplete, duplicated, or inconsistently categorized, making it hard to know which issues to
act on first. CivicConnect solves this with:

- A simple citizen-facing complaint form
- A rule-based **smart prioritization engine** (category + age + similar-complaint volume)
- **Duplicate/similar complaint detection** so departments don't send crews to the same spot twice
- A structured **admin workflow** (`NEW → ASSIGNED → IN PROGRESS → RESOLVED`) with department
  assignment, comments, and full status history
- An **analytics dashboard** with SLA tracking, aging complaints, and hotspot detection

---

## Features

### Citizen Portal
- Submit a complaint with category, description, location, and priority
- Automatic unique complaint ID (e.g. `CMP-1001`)
- Instant smart-priority calculation and confirmation screen

### Admin Portal
- View, search, and filter all complaints (by category, status, priority, free-text search)
- Full complaint detail view with priority breakdown, similar-complaint count, comments, and
  status history
- Assign complaints to one of four departments
- Enforced valid status transitions (no skipping steps)
- Add timestamped comments at any stage

### Smart Prioritization Engine
```
Priority Score = Category Score + Age Score + Similar Complaint Score

Category Score:  Water Supply = 3, Streetlight = 2, Pothole = 2, Garbage = 1, Other = 1
Age Score:        < 2 days = 1, 2–5 days = 2, > 5 days = 3
Similar Score:    0–2 similar = 1, 3–5 similar = 2, > 5 similar = 3

Final Priority:   3–4 = LOW, 5–6 = MEDIUM, 7–8 = HIGH, 9 = CRITICAL
```

### Duplicate / Similar Complaint Detection
Complaints are considered similar when they share the same **category** and **location** and are
not yet `RESOLVED`. The count feeds directly into the prioritization engine and is shown on the
complaint detail page, with a "Potential Duplicate" flag at 3+ similar complaints.

### Analytics Dashboard 
- Summary cards: total, new, assigned, in progress, resolved, unresolved, SLA breached
- Issue distribution by category (pie chart)
- Unresolved complaints table
- Aging complaints (oldest first, SLA-breached rows highlighted)
- High-priority locations (HIGH/CRITICAL hotspots)
- SLA performance: met / breached / at risk / within SLA, using per-priority SLA limits
  (LOW = 7 days, MEDIUM = 5 days, HIGH = 3 days, CRITICAL = 1 day)

---

## Technology Stack

**Frontend:** React, Vite, Tailwind CSS, React Router DOM, Recharts, Axios
**Backend:** Python, FastAPI, Uvicorn, Motor (async MongoDB driver), Pydantic
**Database:** MongoDB Atlas

---

## Architecture

```
┌────────────────┐      HTTPS/JSON      ┌───────────────────┐      Motor      ┌─────────────────┐
│   React (Vite)  │ ───────────────────> │   FastAPI backend  │ ──────────────> │  MongoDB Atlas   │
│  Citizen + Admin│ <─────────────────── │  REST API + rules   │ <────────────── │  complaints coll.│
└────────────────┘                      └───────────────────┘                 └─────────────────┘
```

- The frontend is a single Vite app with two experiences: the public citizen portal (`/`,
  `/submit-complaint`, `/complaint-success`) and the admin portal (`/admin/*`).
- The backend is a modular FastAPI app: routes call into `services/` (priority engine + duplicate
  detector) which operate on plain dict documents stored in MongoDB via Motor.
- All business rules (status transitions, SLA limits, priority scoring) live in the backend so the
  frontend just renders what the API returns.

---

## Folder Structure

```
smart-civic-management/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── seed.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── complaint.py
│   ├── schemas/
│   │   └── complaint.py
│   ├── routes/
│   │   ├── complaints.py
│   │   └── analytics.py
│   └── services/
│       ├── priority_engine.py
│       └── duplicate_detector.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── ComplaintTable.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── PriorityBadge.jsx
│   │   │   └── DashboardCard.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── SubmitComplaint.jsx
│   │   │   ├── ComplaintSuccess.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── Complaints.jsx
│   │   │   ├── ComplaintDetails.jsx
│   │   │   └── Analytics.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
│
├── README.md
└── .gitignore
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- A MongoDB Atlas cluster (or a local MongoDB instance for development)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and set MONGODB_URI to your MongoDB Atlas connection string

# Seed the database with 45 realistic sample complaints
python seed.py

# Start the API server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install

cp .env.example .env
# Defaults to http://localhost:8000, only change if your backend runs elsewhere

npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

### `backend/.env`
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB_NAME=smart_civic_db
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### `frontend/.env`
```env
VITE_API_URL=http://localhost:8000
```

---

## API Endpoints

| Method | Endpoint                              | Description                              |
|--------|----------------------------------------|-------------------------------------------|
| POST   | `/complaints`                          | Create a new complaint                    |
| GET    | `/complaints`                          | List complaints (filters: `category`, `status`, `priority`, `search`, `location`, `escalated`) |
| GET    | `/complaints/{complaint_id}`           | Get full details of one complaint (includes priority breakdown, cluster info, escalation status) |
| PUT    | `/complaints/{complaint_id}/assign`    | Assign a complaint to a department        |
| PUT    | `/complaints/{complaint_id}/status`    | Update complaint status (validated transitions) |
| POST   | `/complaints/{complaint_id}/comments`  | Add a comment to a complaint              |
| POST   | `/complaints/analyze`                  | **New** — optional AI-assisted extraction from free text |
| GET    | `/complaints/meta/departments`         | Category → suggested department mapping   |
| GET    | `/analytics/dashboard`                 | Full analytics payload (now includes `escalated_complaints`) |
| GET    | `/analytics/common-issues`             | **New** — Common Civic Issue clusters     |
| GET    | `/analytics/heatmap`                   | **New** — location intelligence data      |
| GET    | `/health`                              | Health check                              |

---

## Testing the Application

1. **Seed data**: run `python seed.py` from `backend/` to load 45 realistic complaints across all
   categories, locations, statuses, and ages — including deliberate clusters of similar complaints
   and some SLA-breached ones.
2. **Citizen flow**: go to `/submit-complaint`, submit a complaint, and confirm you land on the
   success page with a generated `CMP-XXXX` ID and a computed smart priority.
3. **Admin list & filters**: go to `/admin/complaints`, and try the search box plus the category,
   status, and priority filters.
4. **Complaint detail & workflow**: open any `NEW` complaint, assign it to a department (status
   moves to `ASSIGNED`), then advance it through `IN PROGRESS` → `RESOLVED`. Confirm that trying to
   skip a step (e.g. jump straight to `RESOLVED`) is rejected by the "Update Status" buttons only
   showing valid next states — the backend also rejects invalid transitions with a 400 error if
   called directly.
5. **Comments & history**: add a comment on a complaint and confirm it appears immediately, and
   that the status history timeline reflects every assignment/status change.
6. **Duplicate detection**: submit two complaints with the same category and location, and confirm
   the "Similar Complaints" count and "Potential Duplicate" flag appear once 3+ exist.
7. **Dashboard & analytics**: visit `/admin` and `/admin/analytics` and confirm the summary cards,
   pie/bar charts, aging complaints table, high-priority locations, and SLA performance figures
   match what's in the database.

---

## Future Improvements

- Authentication and role-based access (citizen / department officer / super admin)
- Photo/attachment upload for complaints
- Map view for plotting complaint locations geographically
- Email/SMS notifications on status changes
- ML-based text classification to replace/augment the rule-based category & urgency detection
- Pagination and server-side sorting for very large complaint volumes
- Automated SLA escalation workflows (auto-reassign or alert on breach)

---

## Screenshots

> _Add screenshots here after running the app locally._

- `docs/screenshots/home.png` — Citizen landing page
- `docs/screenshots/submit-complaint.png` — Complaint submission form
- `docs/screenshots/admin-dashboard.png` — Admin dashboard
- `docs/screenshots/complaint-details.png` — Complaint detail & workflow
- `docs/screenshots/analytics.png` — Analytics page
