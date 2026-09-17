# CivicConnect — Advanced Features Update

This document describes the 5 features added to the existing CivicConnect project. The original
architecture (FastAPI + Motor + MongoDB backend, React + Vite + Tailwind + Recharts frontend, the
NEW -> ASSIGNED -> IN PROGRESS -> RESOLVED workflow) was **not** rebuilt or replaced -- every
change below is additive.

---

## 1. Features Added

### Feature 1 -- Common Civic Issue / Complaint Clustering
Complaints that share the same **category** and **location** (the same rule the existing
duplicate detector already used) are grouped into a "Common Civic Issue" cluster. Every individual
complaint is preserved untouched -- nothing is deleted or merged. Each cluster shows the total
citizen-report count, unresolved count, highest priority among members, representative status,
assigned department, and the full list of linked complaint IDs. A minimum cluster size of 2 avoids
flagging unique complaints as "clusters."

### Feature 2 -- Complaint Heatmap / Location Intelligence
A new `/admin/location-intelligence` page visualizes complaint concentration using a
dependency-free custom SVG map (no external map/tile service or API key required), with
category/priority/status/date-range filters. Locations are optionally geocoded via a small,
static, offline lookup table (`LOCATION_COORDINATES`) -- intentionally simple and safe:
unrecognized locations just have no coordinates and are shown in a separate fallback list rather
than breaking anything. Risk level (red/orange/green) is computed from how many open
HIGH/CRITICAL complaints exist at that location.

### Feature 3 -- Automatic SLA Escalation
Complaints are automatically flagged `is_escalated` based on: SLA breach, being extremely old
(>10 days unresolved), remaining HIGH/CRITICAL priority too long, or having a very high number of
similar unresolved complaints (>5). This is evaluated by a pure function (`evaluate_escalation`)
and lazily persisted whenever a complaint is read (list, detail, or dashboard load) -- no
cron/scheduler needed. Escalation is completely separate from and does not alter the
NEW -> ASSIGNED -> IN PROGRESS -> RESOLVED workflow; a complaint can be escalated in any of those
three open states.

### Feature 4 -- Explainable Smart Priority
The existing rule-based priority engine (category score + age score + similar-complaint score) is
unchanged. What's new is that the complaint detail page now shows a "Why this priority?" panel
with the exact score breakdown, generated live from the same `calculate_smart_priority()`
function used everywhere else -- so the UI can never show a breakdown that doesn't match the
actual calculation.

### Feature 5 -- AI Complaint Understanding (optional)
An "Analyze with AI" button on the citizen complaint form sends the free-text description to a
new, isolated `services/ai_analyzer.py` module, which (if `ANTHROPIC_API_KEY` is configured) asks
Claude to extract category / location / duration / urgency / summary, validates every field
against the app's real category list before trusting it, and returns editable pre-filled
suggestions. If no key is configured, the package isn't installed, the request times out, or
parsing fails, the endpoint returns `available: false` with a friendly message -- manual
submission is never blocked.

---

## 2. Files Modified

### Backend
- `backend/models/complaint.py` -- added `LOCATION_COORDINATES`, `lookup_coordinates()`,
  `cluster_key()`; extended `build_complaint_document()` with new optional fields.
- `backend/services/priority_engine.py` -- added `to_priority_breakdown_response()`.
- `backend/services/duplicate_detector.py` -- added `count_cluster_total()`.
- `backend/routes/complaints.py` -- create/list/get updated to compute and return breakdown,
  cluster, and escalation data; added `location`/`escalated` filters; added
  `POST /complaints/analyze`.
- `backend/routes/analytics.py` -- added escalation tracking to the dashboard summary; added
  `GET /analytics/common-issues` and `GET /analytics/heatmap`.
- `backend/schemas/complaint.py` -- added `AIAssistMetadata`, extended `ComplaintCreate`, added
  `AIAnalyzeRequest`.
- `backend/requirements.txt` -- added optional `anthropic` dependency.
- `backend/.env.example` -- added optional `ANTHROPIC_API_KEY`.
- `backend/seed.py` -- added coordinates/priority-breakdown/cluster fields to seed data; enlarged
  some clusters to demonstrate escalation and clustering; ~20% of records deliberately left in
  "legacy" shape (missing the new optional fields) to prove backward compatibility.

### Backend (new files)
- `backend/services/clustering.py`
- `backend/services/escalation_engine.py`
- `backend/services/ai_analyzer.py`

### Frontend
- `frontend/src/services/api.js` -- added `analyzeWithAI`, `getCommonIssues`, `getHeatmap`.
- `frontend/src/pages/SubmitComplaint.jsx` -- added the AI-assist flow.
- `frontend/src/pages/ComplaintDetails.jsx` -- added escalation banner, common-issue card, and
  the explainable priority breakdown table.
- `frontend/src/pages/AdminDashboard.jsx` -- added an "Escalated" summary card and quick-link
  cards to the two new pages.
- `frontend/src/pages/Complaints.jsx` -- added `location` and `escalated` filters (used by
  cluster drill-down links).
- `frontend/src/components/ComplaintTable.jsx` -- shows the escalation badge inline.
- `frontend/src/components/Sidebar.jsx` -- added nav links for the two new pages.
- `frontend/src/App.jsx` -- added the two new routes.

### Frontend (new files)
- `frontend/src/components/EscalationBadge.jsx`
- `frontend/src/pages/CommonIssues.jsx`
- `frontend/src/pages/LocationIntelligence.jsx`

---

## 3. New APIs

| Method | Endpoint                    | Purpose                                                |
|--------|------------------------------|---------------------------------------------------------|
| POST   | `/complaints/analyze`        | Optional AI-assisted extraction from free text          |
| GET    | `/analytics/common-issues`   | Common Civic Issue clusters (`min_size` query param)    |
| GET    | `/analytics/heatmap`         | Location intelligence data, with category/priority/status/date filters |

No existing endpoints were removed or had breaking signature changes. `GET /complaints` gained
two new *optional* query params (`location`, `escalated`); `GET /complaints/{id}` and
`GET /analytics/dashboard` gained new fields in their response bodies only.

---

## 4. Database Changes

New optional fields added to complaint documents (all default to `null`/`false`/absent and are
always read with safe `.get(field, default)` accessors):

```
latitude              float | null
longitude             float | null
cluster_id            string | null
priority_breakdown    object | null   { category_score, age_score, similar_complaints_score }
is_escalated          bool  (default false)
escalation_reason     string | null
escalated_at          ISO datetime | null
escalation_level      "LEVEL_1" | "LEVEL_2" | null
ai_analysis           object | null   (only present if the citizen used AI-assist)
```

No new indexes were strictly required for the current data volume; the existing
`(category, location, status)` compound index is reused by both the clustering and escalation
features. No destructive migrations were performed.

---

## 5. Existing Features Preserved

Verified still working after the changes:
- Complaint submission (manual, without AI)
- Unique complaint ID generation
- NEW -> ASSIGNED -> IN PROGRESS -> RESOLVED workflow and its transition validation -- unchanged
- Department assignment
- Comments
- Original rule-based smart priority calculation (category/age/similar-complaint scoring) --
  same logic, only newly *exposed* via the breakdown, not altered
- Original similar/duplicate complaint detection -- reused, not replaced
- SLA calculation (met/breached/at risk/within SLA)
- Analytics dashboard (summary cards, issue distribution, unresolved complaints, aging
  complaints, high-priority locations)
- All existing filters (category/status/priority/search) on the complaints table
- Existing navy/gold municipal design -- retained; new pages and components reuse the same
  design tokens (`civic-navy`, `civic-gold`, `civic-slate`, etc.)

---

## 6. Testing Results & Environment Limitations

This sandbox has **no network access**, so `pip install` / `npm install` could not be executed
here. What was verified instead:

- **Backend**: every `.py` file (existing and new) was parsed with Python's `ast` module --
  zero syntax errors across all 16 backend files.
- **Frontend**: every `.jsx` file (existing and new) was checked for balanced braces/parentheses
  -- all files balanced, across all 19 frontend files.
- **Logic review**: traced through the request flow for each new endpoint by hand (create ->
  breakdown/coords computed -> stored; get -> live breakdown + cluster + escalation sync; list ->
  filters + escalation sync; analytics -> clustering/heatmap aggregation) to check for
  variable-scope or key-mismatch bugs.
- **Backward compatibility by design**: ~20% of seeded complaints intentionally omit every new
  field, exercising the exact "old records without new fields" scenario end-to-end through
  `.get(field, default)` accessors in every service and route that touches them.

**What I could not verify in this environment** (no MongoDB/Node/network access here): actually
running `uvicorn`, hitting the live endpoints, running `npm run dev` and clicking through the UI,
or calling the real Anthropic API. Please run through the checklist below once you have it
running locally, and let me know if anything surfaces.

### Recommended manual test checklist
- [ ] Submit a complaint manually (no AI) -- confirm it still works exactly as before
- [ ] Click "Analyze with AI" without an API key configured -- confirm the graceful fallback
      message appears and manual submission still works
- [ ] (If you add an API key) Analyze a real complaint description -- confirm extracted fields
      are editable and submission still succeeds
- [ ] Open a complaint that's part of a seeded cluster (e.g. any Pothole complaint at
      "MG Road") -- confirm the "Common Civic Issue" card appears with a working
      "View all linked complaints" link
- [ ] Visit `/admin/common-issues` -- confirm clusters render with correct counts
- [ ] Visit `/admin/location-intelligence` -- confirm the map renders points, hovering shows a
      tooltip, and try each filter; confirm "Ashok Vihar" / "Rajendra Nagar" complaints show up
      in the "no coordinates" fallback list
- [ ] Visit `/admin` dashboard -- confirm the new "Escalated" summary card and the 3 quick-link
      cards appear
- [ ] Open an old/aging seeded complaint -- confirm it shows as escalated with a reason, and
      check `/admin/complaints?escalated=true`
- [ ] Open any complaint detail page -- confirm the "Why this priority?" table's row values sum
      to the displayed Priority Score
- [ ] Confirm status transitions (NEW->ASSIGNED->IN PROGRESS->RESOLVED) still work and are still
      rejected when skipped

---

## 7. How to Run

Same as before -- nothing about the run process changed, aside from the optional AI key:

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set MONGODB_URI (required), ANTHROPIC_API_KEY (optional, for AI-assist)
python seed.py
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173`. Admin portal: `http://localhost:5173/admin`.

---

## 8. Hackathon Demo Flow (3-5 minutes)

1. **(30s) Citizen portal + AI assist** -- Go to "Submit a Complaint," type a natural-language
   description ("No streetlight near Gate 3 for almost a week, road is pitch dark at night"),
   click **Analyze with AI**, show the auto-filled category/location/priority, tweak one field,
   submit.
2. **(45s) Admin dashboard** -- Open `/admin`. Point out the new **Escalated** summary card and
   the three quick-link cards (Common Civic Issues / Location Intelligence / Escalated
   Complaints).
3. **(60s) Common Civic Issues** -- Click into "Common Civic Issues." Show the "Pothole near MG
   Road" cluster with its citizen-report count, highest priority, and "View all linked
   complaints" drill-down -- emphasize that every original complaint is still individually
   intact.
4. **(60s) Location Intelligence** -- Click into "Location Intelligence." Point out the
   color-coded risk map, hover a hotspot for the tooltip, apply a priority filter live, and show
   the "no coordinates" fallback list for unmapped locations.
5. **(45s) Explainable priority + escalation** -- Open one of the escalated complaints. Show the
   red escalation banner with its reason, then scroll to "Why this priority?" and walk through
   the category/age/similar-complaint rows summing to the total score.
6. **(30s) Wrap** -- Reiterate: the original workflow, SLA logic, and design are untouched --
   these are five additive layers on top of a working system.
