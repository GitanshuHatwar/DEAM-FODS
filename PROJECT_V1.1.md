# Industrial Ticketing + AI Triage + RFID Tap System

**Document version:** 1.1 (adds the Admin / Super Admin role)
**Release:** Version 1 (Prototype)
**Stack:** FastAPI · Supabase (Postgres + Auth + Storage) · React (Vite) · Gemini API
**V1 scale target:** 1 customer, 1 technician, 1 admin, 3–4 RFID scanner devices

---

## Table of Contents

1. [What Changed in v1.1](#1-what-changed-in-v11)
2. [Project Overview](#2-project-overview)
3. [Version 1 Goals](#3-version-1-goals)
4. [Roles and Permissions](#4-roles-and-permissions)
5. [Scope](#5-scope)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Architecture](#8-architecture)
9. [Tech Stack](#9-tech-stack)
10. [Ticket Lifecycle and Tap Workflow](#10-ticket-lifecycle-and-tap-workflow)
11. [Admin Management Rules](#11-admin-management-rules)
12. [Data Model](#12-data-model)
13. [Storage](#13-storage)
14. [API Contract](#14-api-contract)
15. [Frontend Structure](#15-frontend-structure)
16. [Backend Structure](#16-backend-structure)
17. [Configuration](#17-configuration)
18. [Setup Instructions](#18-setup-instructions)
19. [Testing Plan](#19-testing-plan)
20. [Task Board](#20-task-board)
21. [Milestones](#21-milestones)
22. [Team Guidelines](#22-team-guidelines)
23. [Acceptance Criteria and Demo Scenario](#23-acceptance-criteria-and-demo-scenario)
24. [Assumptions and Open Questions](#24-assumptions-and-open-questions)
25. [Roadmap (V2 and Beyond)](#25-roadmap-v2-and-beyond)

---

## 1. What Changed in v1.1

| Area | v1.0 | v1.1 |
|---|---|---|
| Roles | `customer`, `technician` | `customer`, `technician`, **`admin` (super admin)** |
| User accounts | Customers self-register, technicians promoted manually in Supabase | Customers can self-register; **technician and admin accounts are created by an admin** inside the app |
| Device delete | Not defined | **Admin only**, with archive (soft delete) as the default |
| User management | None in app | **Admin console**: create, edit, change role, deactivate, delete users and technicians |
| Scanners | Seeded via SQL | **Admin can add, deactivate and rotate keys** for scanners |
| Audit | Ticket status history only | Adds an **admin audit log** of every admin action |
| Tap behavior | 4 modes | Adds a 5th mode, `archived_tag`, for taps on archived devices |

Everything else (ticket lifecycle, tap workflow, AI analysis, priority queue, SSE) is unchanged from v1.0.

---

## 2. Project Overview

A web platform for raising and resolving maintenance tickets on industrial devices.

- A **customer** raises a ticket for a device with a description, the date and time of the issue, and up to 2 images.
- An **AI model (Gemini)** analyzes the ticket and rates its criticality.
- A **smart priority queue** orders tickets on the technician dashboard.
- A **technician** taps an RFID card on the machine. The ESP scanner sends the RFID and scanner ID to the backend, which looks up the device and instantly pushes the relevant ticket and device details to the technician dashboard.
- A **history database** stores every incident and maintenance update per device.
- An **admin (super admin)** manages devices, scanners, technicians, customers and other admins, and can see everything.

The hardware (ESP + RFID reader) is already built. This document covers the software only.

**Core principle:** the RFID UID is the primary key of a device. Every lookup, relationship and tap event is keyed on it.

---

## 3. Version 1 Goals

| # | Goal | Success measure |
|---|---|---|
| G1 | Customers can report a problem on any registered device in under 2 minutes | Ticket form works on mobile and desktop, with 2 compressed images |
| G2 | Every ticket is automatically rated for criticality | AI severity appears on the ticket within seconds, with a fallback if Gemini fails |
| G3 | Technicians always see the most urgent work first | Queue is sorted by priority (AI + device criticality + safety + aging) |
| G4 | A tap on a machine instantly shows what the technician needs | Dashboard updates without a page refresh, within about 1 second of the tap |
| G5 | The tap drives the work process | Tap 1 starts the work, tap 2 opens close-out, form submission resolves the ticket |
| G6 | Every device has a permanent history | Each resolved ticket writes an incident and a maintenance log |
| G7 | Admin has full control of the system | Admin can add, edit, archive and delete devices, and manage all user accounts |
| G8 | The system is safe to demo and safe to extend | Role-based access, audit trail, no secrets in the frontend, documented API |

---

## 4. Roles and Permissions

Roles are stored in the `profiles` table and read by the backend on every request. They are **never trusted from the token alone**.

### 4.1 Role summary

| Role | Who | How the account is created |
|---|---|---|
| `customer` | Person reporting problems | Self-signup, or created by an admin |
| `technician` | Person who repairs devices | Created by an admin only |
| `admin` | Super admin | Created by an admin only. The **first** admin is bootstrapped manually in Supabase |

An admin inherits all technician abilities. A technician inherits nothing from admin.

### 4.2 Permission matrix

| Capability | Customer | Technician | Admin |
|---|:---:|:---:|:---:|
| Sign up, log in, view own profile | ✓ | ✓ | ✓ |
| Raise a ticket | ✓ | – | – |
| View own tickets | ✓ | – | – |
| View all tickets and the priority queue | – | ✓ | ✓ |
| Override ticket priority | – | ✓ | ✓ |
| Receive live tap panel (SSE) | – | ✓ | ✓ |
| Resolve a ticket (close-out form) | – | ✓ | ✓ |
| View device details and history | – | ✓ | ✓ |
| **Add a device** | – | ✓ | ✓ |
| **Edit a device** (details, dates, images, status) | – | ✓ | ✓ |
| Add a maintenance log | – | ✓ | ✓ |
| Re-key a device (replace RFID tag) | – | – | ✓ |
| **Archive / restore a device** | – | – | ✓ |
| **Permanently delete a device** | – | – | ✓ |
| **Create users** (customer, technician, admin) | – | – | ✓ |
| **Edit users** (name, role, active status) | – | – | ✓ |
| **Deactivate / reactivate users** | – | – | ✓ |
| **Delete users** | – | – | ✓ |
| Reset a user's password | – | – | ✓ |
| Manage scanners (add, deactivate, rotate key) | – | – | ✓ |
| View admin audit log | – | – | ✓ |

> Technicians keep add and edit rights on devices (decided in v1.0). **Deleting** is admin only. See Open Question Q1 if you want device creation moved to admin only.

### 4.3 Admin safety rules

- An admin cannot delete, deactivate or demote **their own** account.
- The system must always keep **at least one active admin**. Any action that would remove the last one is rejected.
- Every admin action is written to the audit log.
- Destructive actions require a confirmation step in the UI.

---

## 5. Scope

### In scope (V1)

**Accounts and access**
- Supabase Auth (email + password) with three roles
- Admin console for users, technicians, devices and scanners
- Admin audit log

**Customer**
- Raise tickets using a device dropdown or manual RFID entry
- 2 images per ticket, compressed on the client
- Track status: Pending Review → Under Review → Resolved

**Technician**
- Priority queue with filters
- Ticket detail with the customer's complaint, images and AI analysis
- Live tap panel with five modes
- Add and edit devices (details, dates, images)
- Add maintenance logs and resolve tickets with a close-out form

**Platform**
- Gemini criticality analysis with rule-based fallback
- Composite priority scoring with aging
- Device history (incidents + maintenance logs)
- Live tap updates via Server-Sent Events (no polling, no WebSockets)
- ESP simulator for testing without hardware

### Out of scope (V2+)

Redis, Celery, WebSockets, multi-site and multi-tenant, SLA timers and escalation, email/WhatsApp notifications, HMAC request signing for the ESP, per-technician tap routing and assignment, predictive maintenance, QR scanning, native mobile app, reporting dashboards, bulk import of devices or users.

---

## 6. Functional Requirements

Priority: **M** = must have for V1, **S** = should have, **C** = could have.

### 6.1 Authentication and accounts

| ID | Requirement | Pri |
|---|---|---|
| FR-AU1 | Users log in with email and password through Supabase Auth | M |
| FR-AU2 | Public signup always creates a `customer` | M |
| FR-AU3 | After login, users are redirected by role: customer → `/portal`, technician → `/tech`, admin → `/admin` | M |
| FR-AU4 | Deactivated users cannot use the API even with a valid token | M |
| FR-AU5 | Backend reads the role from `profiles` on every request | M |
| FR-AU6 | Session persists across page reloads; logout clears it | M |

### 6.2 Customer portal

| ID | Requirement | Pri |
|---|---|---|
| FR-C1 | Raise a ticket with: device, title, description, date and time of the issue, images | M |
| FR-C2 | Device is chosen from a dropdown **or** by typing an RFID ID, which is validated against the database | M |
| FR-C3 | Maximum 2 images; client compresses each to roughly 300–500 KB; server rejects anything over 1 MB | M |
| FR-C4 | Accepted image types: JPEG, PNG, WebP | M |
| FR-C5 | "My Tickets" list with a 3-step status stepper | M |
| FR-C6 | Ticket detail shows status, AI severity, and the resolution once resolved | M |
| FR-C7 | Customers can never see other customers' tickets | M |
| FR-C8 | Archived devices cannot be selected or accepted for new tickets | M |

### 6.3 Technician dashboard

| ID | Requirement | Pri |
|---|---|---|
| FR-T1 | Priority queue of `pending_review` and `under_review` tickets, sorted by effective priority | M |
| FR-T2 | Filter queue by status; show severity badge, device, age and priority | M |
| FR-T3 | Ticket detail: complaint, image gallery, AI analysis (severity, probable cause, summary), device history | M |
| FR-T4 | Manual priority override, which can be cleared | M |
| FR-T5 | Queue auto-refreshes on an interval (about 15 seconds) | S |
| FR-T6 | No manual "start work" button; the tap starts work | M |

### 6.4 RFID tap and live panel

| ID | Requirement | Pri |
|---|---|---|
| FR-R1 | ESP sends the RFID and scanner ID with a device key; the backend authenticates the scanner | M |
| FR-R2 | RFID values are normalized (trimmed, separators removed, uppercase) everywhere | M |
| FR-R3 | The backend looks up the device by RFID (primary key) and decides one of five modes (see §10.2) | M |
| FR-R4 | Tap 1 on a device with a pending ticket moves the highest-priority one to `under_review` | M |
| FR-R5 | Tap 2 opens the close-out form; it does not resolve the ticket | M |
| FR-R6 | The dashboard receives the full payload instantly through SSE | M |
| FR-R7 | Duplicate taps (same scanner and RFID within 3 seconds) are ignored | M |
| FR-R8 | Unknown and archived tags are logged and shown with a clear message | M |
| FR-R9 | On page load, the dashboard fetches the latest tap once, ignoring taps older than about 30 seconds | S |
| FR-R10 | Connection indicator shows connected or reconnecting | S |
| FR-R11 | The ESP receives a tiny response so it can signal success or failure | M |

### 6.5 Device management

| ID | Requirement | Pri |
|---|---|---|
| FR-D1 | Add a device: RFID ID, name, model, serial number, location, criticality (1–5), status, install date, warranty expiry, last service date, next service due, notes, up to 3 photos | M |
| FR-D2 | Edit any of those fields at any time | M |
| FR-D3 | Device detail page with a history timeline (incidents + maintenance logs merged by date) | M |
| FR-D4 | Add a standalone maintenance log | M |
| FR-D5 | Admin can **archive** a device (soft delete) and **restore** it | M |
| FR-D6 | Admin can **permanently delete** a device only when it has no tickets, incidents or maintenance logs | M |
| FR-D7 | Admin can replace a damaged tag (**re-key**); all references update automatically | M |
| FR-D8 | Duplicate RFID IDs are rejected | M |

### 6.6 Admin console

| ID | Requirement | Pri |
|---|---|---|
| FR-A1 | List all users with role, status and created date; search and filter by role | M |
| FR-A2 | Create a user (customer, technician or admin) with email, name, role and an initial password | M |
| FR-A3 | Edit a user's name and role | M |
| FR-A4 | Deactivate and reactivate a user | M |
| FR-A5 | Delete a user only when they have no linked tickets or records; otherwise the API suggests deactivation | M |
| FR-A6 | Reset a user's password | S |
| FR-A7 | Enforce the safety rules in §4.3 (no self-delete, no self-demote, keep at least one admin) | M |
| FR-A8 | Manage scanners: add, edit location, deactivate, rotate the device key (key shown once) | S |
| FR-A9 | View the admin audit log with filters by actor, action and date | S |
| FR-A10 | Admin overview page with counts: open tickets, devices, users, scanners last seen | C |
| FR-A11 | Admin can use every technician feature, including the live tap panel and close-out | M |

### 6.7 AI analysis and priority

| ID | Requirement | Pri |
|---|---|---|
| FR-AI1 | After ticket creation, Gemini analyzes the description, images, device details and the last 5 incidents | M |
| FR-AI2 | Output is structured: severity (critical, high, medium, low), score 0–100, safety risk, probable cause, summary | M |
| FR-AI3 | One retry on failure, then a fallback (medium, score 50) so a ticket never gets stuck | M |
| FR-AI4 | The raw AI response is stored for audit | M |
| FR-AI5 | Base priority = 60% of AI score + 6 × device criticality (max 30) + 25 if safety risk, capped at 100 | M |
| FR-AI6 | Effective priority adds aging: +0.1 per hour open, capped at +10 | M |
| FR-AI7 | A manual override replaces the computed priority | M |
| FR-AI8 | Ticket creation never waits for the AI | M |

### 6.8 Resolution and history

| ID | Requirement | Pri |
|---|---|---|
| FR-H1 | The close-out form collects root cause, resolution, parts replaced, and updated device details (status, dates, notes) | M |
| FR-H2 | Submitting the form resolves the ticket in **one atomic database operation** that also writes the incident, the maintenance log, the device update and the status history | M |
| FR-H3 | Only an `under_review` ticket can be resolved; other states return a conflict error | M |
| FR-H4 | New device photos taken during close-out are uploaded before the resolve call | S |
| FR-H5 | History is append-only and survives device archiving | M |

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Performance** | Tap endpoint responds in under 300 ms; the dashboard shows the tap within about 1 second. Ticket creation returns without waiting for the AI. |
| **Security** | Service key and Gemini key exist only in backend configuration. RLS is enabled on all tables with no policies (deny by default). Every non-public endpoint enforces role checks. Device keys are stored hashed. Image type and size are validated on the server. |
| **Reliability** | AI failure never blocks a ticket. Duplicate taps are ignored. Resolve is atomic. The SSE client reconnects automatically. |
| **Auditability** | Ticket status changes are recorded with who, when and how (tap, form, system). Admin actions are recorded in the audit log. |
| **Data retention** | Incidents, maintenance logs and ticket history are never deleted by normal operations. Devices and users are archived or deactivated by default. |
| **Usability** | Customer pages work on mobile. Every screen has loading, empty and error states. Destructive actions need confirmation. |
| **Time handling** | All timestamps stored in UTC and displayed in local time. |
| **Maintainability** | Router → service → database layering. API documented through the auto-generated OpenAPI page. |
| **Limits** | Single backend worker in V1 (in-memory SSE publisher). Designed for 1 technician and 3–4 scanners. |

---

## 8. Architecture

### 8.1 Components

| Component | Responsibility |
|---|---|
| **React frontend (Vite)** | Three route groups: `/portal` (customer), `/tech` (technician), `/admin` (admin). Uses Supabase JS for login only; all data goes through the API. |
| **FastAPI backend** | Single service. Authenticates users and scanners, enforces roles, runs business rules, talks to Supabase and Gemini, and streams tap events. |
| **Supabase Auth** | Email and password login, token issuing, account suspension (used for deactivation). The backend uses the service key to create and manage users. |
| **Supabase Postgres** | All application data. Row-level security is on and denies direct access; only the backend (service key) reads and writes. |
| **Supabase Storage** | Two private buckets for ticket images and device images, served through short-lived signed URLs. |
| **Gemini API** | Structured criticality analysis of each new ticket. |
| **ESP + RFID scanner** | Sends tap requests with a device key. Existing hardware. |
| **SSE channel** | One-way server-to-browser stream that delivers tap payloads to open technician and admin dashboards. |

### 8.2 Layering inside the backend

1. **Routers** handle HTTP: parsing, validation, status codes.
2. **Dependencies** handle authentication and role checks.
3. **Services** hold business rules: tap decision logic, priority scoring, AI analysis, storage handling, admin safety rules.
4. **Database layer** is the Supabase client plus one database function for the atomic resolve.

### 8.3 Security architecture

1. The browser holds only the Supabase **anon key** and the user's session token.
2. Every API request carries the token. The backend validates it with Supabase, loads the profile, rejects inactive users, then checks the role.
3. Admin-only endpoints use an admin guard. Technician endpoints accept technician or admin.
4. The ESP never uses a user token. It sends a device key that is compared against a stored hash, and the scanner must be active.
5. Row-level security denies all direct database access from the browser, so a leaked anon key exposes nothing.
6. Creating, deleting, suspending or changing the role of a user is done only by the backend through the Supabase admin API using the service key.
7. The SSE stream requires a technician or admin token. Because the browser's native event source cannot send headers, the frontend uses an SSE client library that supports the Authorization header.

### 8.4 Key flows

**Flow A: Ticket creation and AI analysis**
1. Customer submits the form (multipart: device RFID, title, description, date/time, up to 2 images).
2. Backend validates the device (exists and not archived), the images, and the role.
3. Backend saves the ticket as `pending_review`, uploads the images, records a status history row, and returns `201` immediately.
4. A background task builds the AI prompt from the device details, last 5 incidents, the issue text and images, then calls Gemini.
5. On success the ticket gets severity, score, safety flag, cause, summary and a base priority. On failure it gets the fallback values and `ai_status = fallback`.

**Flow B: RFID tap**
1. ESP sends the RFID, scanner ID and device key to the tap endpoint.
2. Backend authenticates the scanner and normalizes the RFID.
3. Duplicates within 3 seconds are ignored.
4. Backend looks up the device by primary key and applies the decision table in §10.2.
5. If the mode is `start`, the ticket moves to `under_review` using a conditional update so two simultaneous taps cannot both start it.
6. The tap is logged, the full payload is built (ticket, device, images as signed URLs, history), and it is published to all connected dashboards.
7. The ESP gets a tiny status response. The dashboard renders the matching panel.

**Flow C: Close-out**
1. After tap 2 the dashboard shows the close-out form beside the original complaint.
2. Technician uploads any new device photos, then submits the form.
3. Backend calls one database function that locks the ticket, checks it is `under_review`, marks it `resolved`, and writes the incident, the maintenance log, the device updates and the status history in a single transaction.
4. The customer sees `Resolved` with the resolution. The next tap on the device shows the new incident in its history.

**Flow D: Admin user management**
1. Admin submits the create-user form (email, name, role, initial password).
2. Backend creates the account through the Supabase admin API, then sets the role in `profiles`.
3. The action is written to the audit log.
4. For deactivation, the backend sets `is_active = false` and suspends the Supabase account, so existing sessions stop working at the next request.
5. For deletion, the backend first checks for linked records. If there are none, it deletes the auth account and the profile. If there are, it returns a conflict and recommends deactivation.

**Flow E: Admin device lifecycle**
1. **Archive** sets an archived timestamp and user. The device disappears from dropdowns and from new tickets, but all history is kept.
2. **Restore** clears the archived fields.
3. **Permanent delete** is allowed only for a device with no tickets, incidents or maintenance logs; otherwise the API returns a conflict.
4. **Re-key** changes the RFID primary key. Foreign keys cascade, so tickets and history follow automatically.

---

## 9. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend API | FastAPI (Python 3.11+), Uvicorn | Single worker in V1 |
| Validation and config | Pydantic v2, pydantic-settings | |
| Database | Supabase Postgres | JSONB for specs and raw AI output |
| Auth | Supabase Auth | Roles live in `profiles` |
| User administration | Supabase Auth admin API (service key, backend only) | Create, suspend, delete, reset password |
| File storage | Supabase Storage | Private buckets, signed URLs |
| AI | Gemini API (`google-genai` SDK) | Model name set by configuration; confirm the current model name before release |
| Background work | FastAPI background tasks | Enough for V1 |
| Realtime | Server-Sent Events | In-memory publisher, single worker |
| Frontend | React + Vite, Tailwind, React Router, TanStack Query | |
| Frontend auth | `@supabase/supabase-js` | Login and session only |
| SSE client | `@microsoft/fetch-event-source` | Supports the Authorization header |
| Image compression | `browser-image-compression` | Max width about 1280 px, about 0.4 MB |
| Testing | pytest, httpx | Vitest optional |
| Linting | ruff, ESLint, Prettier | |

---

## 10. Ticket Lifecycle and Tap Workflow

### 10.1 Ticket states

| Status | Meaning | Moved by |
|---|---|---|
| `pending_review` | Raised by the customer, not yet seen on site | Customer creates it |
| `under_review` | Technician has tapped the machine and is working | **RFID tap** |
| `resolved` | Work done, details updated, ticket closed | **Close-out form submission** |

Only these transitions are allowed: `pending_review → under_review → resolved`. Anything else returns a `409 invalid_transition` error.

### 10.2 Tap decision table

| Order | Condition | Action | Mode sent to dashboard |
|---|---|---|---|
| 1 | RFID not found | Log event | `unknown_tag` |
| 2 | Device is archived | Log event | `archived_tag` |
| 3 | Device has a ticket in `under_review` | No status change | `closeout` |
| 4 | Device has `pending_review` ticket(s) | Move the highest-priority one to `under_review`, set start time, write status history | `start` |
| 5 | No open tickets | None | `asset_only` |

Rules:
- Check order matters. If the technician is already working on a job at that machine, a tap continues that job (row 3 before row 4).
- If several tickets are eligible, the highest effective priority wins and the rest are returned as `other_open_tickets`.
- Tap 2 never resolves a ticket by itself.
- On `start`, the panel leads with the customer-raised details; device history is secondary.
- On `archived_tag`, the panel shows "Device archived" with a **Restore** button for admins only.

### 10.3 ESP response values

| Value | Meaning |
|---|---|
| `ok` (with the mode) | Tap processed |
| `unknown_tag` | RFID not registered |
| `archived_tag` | Device is archived |
| `duplicate` | Ignored as a repeat tap |
| HTTP 401 | Invalid or inactive scanner key |

---

## 11. Admin Management Rules

### 11.1 Users

| Action | Rule |
|---|---|
| Create | Email must be unique. Role can be customer, technician or admin. Initial password is set by the admin; the user should change it on first login. |
| Edit | Name and role can change. An admin cannot change their own role. |
| Deactivate | Sets `is_active = false` and suspends the Supabase account. Reversible. Preferred over delete. |
| Delete | Only if the user has **no** tickets raised, no tickets resolved, and no incident or maintenance records. Otherwise `409 has_linked_records`. |
| Self-protection | An admin cannot delete, deactivate or demote themselves. |
| Last admin | Any action that would leave zero active admins is rejected with `409 last_admin`. |

### 11.2 Devices

| Action | Rule |
|---|---|
| Archive | Soft delete. Device hidden from dropdowns and new tickets. History kept. Existing open tickets stay visible to technicians. |
| Restore | Clears the archived state. |
| Permanent delete | Only when the device has no tickets, incidents or maintenance logs (for example a device added by mistake). Otherwise `409 has_linked_records`. |
| Re-key | Replaces the RFID. The new RFID must be unused. Everything linked follows automatically. |
| Archived tag still holds its RFID | To reuse a tag, re-key the archived device first. |

### 11.3 Scanners

| Action | Rule |
|---|---|
| Add | Admin enters a scanner code and location. The system generates a device key, **shows it once**, and stores only its hash. |
| Rotate key | Generates a new key (shown once) and invalidates the old one. |
| Deactivate | The scanner's taps are rejected with 401. |

### 11.4 Audit log

Every admin action records: who did it, what the action was, the target type and ID, a before and after summary, and the time.

Sample entry:

```json
{
  "id": 412,
  "actor_id": "b1c2d3e4-0000-0000-0000-000000000001",
  "actor_name": "Admin One",
  "action": "user.role_changed",
  "target_type": "user",
  "target_id": "9f8e7d6c-0000-0000-0000-000000000002",
  "details": { "from": "customer", "to": "technician" },
  "at": "2026-11-26T11:05:00Z"
}
```

Actions to log: `user.created`, `user.updated`, `user.role_changed`, `user.deactivated`, `user.reactivated`, `user.deleted`, `user.password_reset`, `device.created`, `device.updated`, `device.archived`, `device.restored`, `device.deleted`, `device.rekeyed`, `scanner.created`, `scanner.deactivated`, `scanner.key_rotated`.

---

## 12. Data Model

Describes the structure only. The SQL scripts are written during task B1.

### 12.1 Entities

**profiles**

| Field | Notes |
|---|---|
| id | Same as the Supabase auth user ID |
| full_name | |
| role | `customer`, `technician` or `admin` |
| is_active | Default true. False blocks all API access |
| created_by | Admin who created the account, if any |
| created_at | |

A database trigger creates a `customer` profile automatically on every public signup.

**assets** (devices; **RFID UID is the primary key**)

| Field | Notes |
|---|---|
| rfid_uid | Primary key, stored normalized |
| name, model, serial_no, location | Basic details |
| criticality | 1–5, feeds priority scoring |
| status | `active`, `under_maintenance`, `retired` |
| install_date, warranty_expiry, last_service_date, next_service_due | Dates |
| notes, specs | Free text and flexible JSON |
| archived_at, archived_by | Null means active (soft delete) |
| created_by, created_at, updated_at | |

**asset_images**: id, asset RFID, storage path, uploaded by, uploaded at. Maximum 3 per device (enforced in the API).

**scanners**: id, scanner code (unique), API key hash, location, is_active, last_seen_at, created_by.

**tickets**

| Field | Notes |
|---|---|
| id, asset RFID, raised_by | Asset RFID uses update-cascade |
| title, description, occurred_at | Customer input |
| status | The three states |
| ai_status | `pending`, `done`, `fallback` |
| ai_severity, ai_score, ai_safety_risk, ai_probable_cause, ai_summary, ai_raw | AI output and the raw response |
| priority_score | Base score without aging |
| priority_override | Manual override, nullable |
| started_at, started_by, resolved_at, resolved_by, created_at | |

**ticket_images**: id, ticket ID, storage path. Maximum 2 per ticket (enforced in the API).

**ticket_status_history**: id, ticket ID, from status, to status, changed by, via (`tap`, `form`, `system`), time.

**incidents**: id, asset RFID, ticket ID, summary, root cause, resolution, parts replaced (JSON), occurred at, resolved at, created by.

**maintenance_logs**: id, asset RFID, ticket ID (optional), type (`preventive`, `corrective`, `inspection`), report, parts replaced (JSON), performed by, performed at, next due date.

**rfid_events**: id, scanner ID, RFID (not a foreign key, so unknown tags can be logged), ticket ID, action (`started`, `closeout_opened`, `asset_viewed`, `unknown_tag`, `archived_tag`), tapped at.

**admin_audit_log**: id, actor ID, action, target type, target ID, details (JSON), time.

### 12.2 Database rules

- All tables have row-level security enabled with **no policies**.
- Foreign keys to `assets.rfid_uid` use **update cascade** so re-keying works.
- Foreign keys to `profiles` do **not** cascade on delete. This is what blocks deleting a user who has records.
- Foreign keys from tickets, incidents and maintenance logs to assets do **not** cascade on delete. This is what blocks deleting a device that has history.
- Indexes: tickets by (status, priority), tickets by asset, tickets by raiser, incidents and maintenance by (asset, date), rfid_events by (scanner, RFID, time), audit log by time.
- A database function performs the atomic resolve (see Flow C). It must verify the status is `under_review` while holding a row lock.

### 12.3 Seed data

- 4 devices with realistic names and RFIDs
- 1 scanner with a known test key
- 1 admin, 1 technician and 1 customer
- A few past incidents and maintenance logs per device

---

## 13. Storage

| Bucket | Access | Path rule | Limits |
|---|---|---|---|
| `ticket-images` | Private | ticket ID / random ID | 2 per ticket, up to 1 MB each |
| `asset-images` | Private | image ID only | 3 per device, up to 1 MB each |

- Allowed types: JPEG, PNG, WebP.
- Images are served through signed URLs that expire after about 1 hour.
- Device image paths never contain the RFID, so re-keying never breaks them.
- Permanently deleting a device or ticket must also remove its stored images.

---

## 14. API Contract

User endpoints need `Authorization: Bearer <Supabase access token>`. The tap endpoint needs `X-Device-Key`. The auto-generated `/docs` page is the source of truth for exact schemas.

### 14.1 Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness check |
| GET | `/me` | any user | Profile and role |
| **Assets** | | | |
| GET | `/assets` | any user | Minimal list for the dropdown (excludes archived) |
| GET | `/assets/lookup?rfid=` | any user | Validate a typed RFID; 404 if unknown or archived |
| GET | `/assets/{rfid}` | technician, admin | Full details and images |
| POST | `/assets` | technician, admin | Add a device |
| PATCH | `/assets/{rfid}` | technician, admin | Edit details, dates, status |
| POST | `/assets/{rfid}/images` | technician, admin | Upload a device photo (max 3) |
| DELETE | `/assets/{rfid}/images/{image_id}` | technician, admin | Remove a photo |
| GET | `/assets/{rfid}/history` | technician, admin | Incidents and maintenance merged |
| POST | `/assets/{rfid}/maintenance` | technician, admin | Add a maintenance log |
| POST | `/assets/{rfid}/archive` | admin | Archive |
| POST | `/assets/{rfid}/restore` | admin | Restore |
| POST | `/assets/{rfid}/rekey` | admin | Replace the RFID |
| DELETE | `/assets/{rfid}` | admin | Permanent delete (only with no linked records) |
| **Tickets** | | | |
| POST | `/tickets` | customer | Create (multipart, max 2 images) |
| GET | `/tickets` | any user | Customer: own. Technician and admin: all, sorted by priority |
| GET | `/tickets/{id}` | any user (customers: own only) | Detail with signed image URLs |
| PATCH | `/tickets/{id}/priority` | technician, admin | Set or clear the override |
| POST | `/tickets/{id}/resolve` | technician, admin | Close-out (atomic) |
| **RFID** | | | |
| POST | `/rfid/tap` | device key | ESP tap |
| GET | `/rfid/stream` | technician, admin | SSE stream |
| GET | `/rfid/latest` | technician, admin | Latest tap payload |
| **Admin: users** | | | |
| GET | `/admin/users` | admin | List; filters: `role`, `active`, `q` |
| POST | `/admin/users` | admin | Create a user |
| GET | `/admin/users/{id}` | admin | Detail |
| PATCH | `/admin/users/{id}` | admin | Edit name or role |
| POST | `/admin/users/{id}/deactivate` | admin | Deactivate |
| POST | `/admin/users/{id}/reactivate` | admin | Reactivate |
| POST | `/admin/users/{id}/reset-password` | admin | Set a new password |
| DELETE | `/admin/users/{id}` | admin | Delete (only with no linked records) |
| **Admin: scanners** | | | |
| GET | `/admin/scanners` | admin | List with last seen |
| POST | `/admin/scanners` | admin | Add; response includes the key **once** |
| PATCH | `/admin/scanners/{id}` | admin | Edit location, activate or deactivate |
| POST | `/admin/scanners/{id}/rotate-key` | admin | New key, shown once |
| **Admin: audit** | | | |
| GET | `/admin/audit-log` | admin | Paginated; filters: `actor`, `action`, `from`, `to` |

### 14.2 Standard error format

```json
{
  "error": {
    "code": "has_linked_records",
    "message": "This user has tickets or history. Deactivate the account instead."
  }
}
```

Error codes: `invalid_token`, `inactive_user`, `forbidden`, `not_found`, `validation_error`, `invalid_transition`, `invalid_device`, `unknown_asset`, `archived_asset`, `duplicate_rfid`, `duplicate_email`, `file_too_large`, `too_many_images`, `unsupported_file_type`, `has_linked_records`, `last_admin`, `self_action_not_allowed`.

### 14.3 Sample requests and responses

**Create a user (admin)**

```json
{
  "email": "tech1@example.com",
  "full_name": "Ravi Kumar",
  "role": "technician",
  "password": "ChangeMe-2026!"
}
```

Response `201`:

```json
{
  "id": "9f8e7d6c-0000-0000-0000-000000000002",
  "email": "tech1@example.com",
  "full_name": "Ravi Kumar",
  "role": "technician",
  "is_active": true,
  "created_at": "2026-11-26T11:00:00Z"
}
```

**Edit a user's role (admin)**

```json
{ "role": "admin" }
```

**Create a scanner (admin)**: the key appears only in this response.

```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000009",
  "scanner_code": "SCN-004",
  "location": "Line 3",
  "device_key": "shown-once-store-it-on-the-esp",
  "is_active": true
}
```

**Create a ticket (customer)**: multipart form fields.

| Field | Example |
|---|---|
| asset_rfid | `04A3B2C1` |
| title | Motor overheating |
| description | Burning smell and vibration since morning |
| occurred_at | `2026-11-26T09:30:00+05:30` |
| images | up to 2 files |

Response `201`:

```json
{
  "id": "d3b07384-0000-0000-0000-000000000010",
  "status": "pending_review",
  "ai_status": "pending",
  "created_at": "2026-11-26T04:05:00Z"
}
```

**Tap request from the ESP**

```json
{ "rfid_uid": "04A3B2C1", "scanner_id": "SCN-001" }
```

Header: `X-Device-Key: <device key>`. Response:

```json
{ "status": "ok", "mode": "start" }
```

**Tap payload delivered to the dashboard (mode `start`)**

```json
{
  "mode": "start",
  "rfid_uid": "04A3B2C1",
  "tapped_at": "2026-11-26T10:12:03Z",
  "scanner_code": "SCN-001",
  "ticket": {
    "id": "d3b07384-0000-0000-0000-000000000010",
    "title": "Motor overheating",
    "description": "Burning smell and vibration since morning",
    "occurred_at": "2026-11-26T09:30:00+05:30",
    "status": "under_review",
    "raised_by": { "full_name": "Customer A" },
    "images": ["https://signed-url-1", "https://signed-url-2"],
    "ai_severity": "high",
    "ai_score": 78,
    "ai_summary": "Likely bearing failure; risk of motor damage",
    "priority": 84.2
  },
  "other_open_tickets": [],
  "asset": {
    "rfid_uid": "04A3B2C1",
    "name": "Conveyor Motor 2",
    "model": "XM-400",
    "location": "Line 2",
    "criticality": 4,
    "status": "active",
    "install_date": "2024-03-01",
    "warranty_expiry": "2027-03-01",
    "last_service_date": "2026-08-10",
    "next_service_due": "2026-11-10",
    "images": ["https://signed-url"],
    "recent_incidents": [],
    "recent_maintenance": []
  }
}
```

Other modes:
- `closeout`: same shape, with the `under_review` ticket.
- `asset_only`: `ticket` is null.
- `unknown_tag`: only `mode`, `rfid_uid`, `tapped_at`, `scanner_code`.
- `archived_tag`: same as `unknown_tag`, plus the device name and the archived date.

**Resolve a ticket**

```json
{
  "root_cause": "Worn bearing on drive shaft",
  "resolution": "Replaced bearing and lubricated",
  "parts_replaced": [{ "name": "Bearing 6205", "qty": 1 }],
  "asset_updates": {
    "status": "active",
    "next_service_due": "2027-02-26",
    "notes": "Check bearing temperature monthly"
  },
  "report": "Optional longer maintenance report"
}
```

**Add a device**

```json
{
  "rfid_uid": "04:a3:b2:c1",
  "name": "Conveyor Motor 2",
  "model": "XM-400",
  "serial_no": "SN-100234",
  "location": "Line 2",
  "criticality": 4,
  "status": "active",
  "install_date": "2024-03-01",
  "warranty_expiry": "2027-03-01",
  "last_service_date": "2026-08-10",
  "next_service_due": "2026-11-10",
  "notes": "Runs 16 hours per day"
}
```

The server stores the RFID normalized as `04A3B2C1`.

---

## 15. Frontend Structure

### 15.1 Routes

| Route | Role | Page |
|---|---|---|
| `/login`, `/signup` | public | Authentication |
| `/portal` | customer | My Tickets |
| `/portal/new` | customer | Raise Ticket |
| `/portal/tickets/:id` | customer | Ticket detail |
| `/tech` | technician, admin | Priority queue |
| `/tech/tickets/:id` | technician, admin | Ticket detail |
| `/tech/devices` | technician, admin | Device list |
| `/tech/devices/new` | technician, admin | Add device (accepts an RFID prefill) |
| `/tech/devices/:rfid` | technician, admin | Device detail and history |
| `/tech/devices/:rfid/edit` | technician, admin | Edit device |
| `/admin` | admin | Overview |
| `/admin/users` | admin | User list |
| `/admin/users/new` | admin | Create user |
| `/admin/users/:id` | admin | Edit user, deactivate, delete |
| `/admin/devices` | admin | Device list with archived filter, archive, restore, delete, re-key |
| `/admin/scanners` | admin | Scanner management |
| `/admin/audit-log` | admin | Audit log |

The live tap panel is mounted once in the shared technician layout, so admins also receive it on every `/tech` and `/admin` page.

### 15.2 Folder layout

- `src/lib`: Supabase client, API wrapper (attaches the token, handles 401 and 403), image compression, RFID normalizer
- `src/auth`: auth provider, role guard, login and signup pages
- `src/features/portal`: raise ticket, my tickets, ticket detail, status stepper, image picker
- `src/features/tech`: technician layout, queue, ticket detail
- `src/features/devices`: device list, form (add and edit), detail, history timeline, maintenance form
- `src/features/tap`: live tap hook, tap panel, one component per mode (start, closeout, asset-only, unknown-tag, archived-tag), connection badge
- `src/features/admin`: admin layout, overview, user list and form, scanner list and form, audit log view, confirmation dialog
- `src/components`: shared buttons, badges, toasts, spinners, empty states

### 15.3 Screen behavior

**Customer:** raise-ticket form with a dropdown and manual RFID toggle, 2-image picker with previews, status stepper on the list.

**Technician and admin:**
- Queue with severity badge, device, age, priority, status filter, override control.
- Ticket detail with complaint, images, AI analysis and device history.
- Tap panel modes:

| Mode | What is shown |
|---|---|
| `start` | Customer-raised ticket up front (title, description, date/time, images, AI summary). Device history in a secondary tab. Switcher for other open tickets. |
| `closeout` | Close-out form beside the original complaint: root cause, resolution, parts, device updates, photos. |
| `asset_only` | Device details, images, history, edit button, add maintenance log. |
| `unknown_tag` | "Unknown tag" with an **Add device with this RFID** shortcut. |
| `archived_tag` | "Device archived" with a **Restore** button visible to admins only. |

**Admin console:**
- Users: searchable table with role and status badges; create, edit, deactivate, reactivate, reset password, delete.
- Deleting shows a confirmation dialog. If the API returns `has_linked_records`, the UI explains and offers **Deactivate** instead.
- Devices: same list as technicians plus archive, restore, permanent delete and re-key.
- Scanners: list with last seen time, add, deactivate, rotate key. The new key appears once in a copy dialog.
- Audit log: paginated table with filters.

**Everywhere:** loading, empty and error states, toast notifications, confirmation on destructive actions.

---

## 16. Backend Structure

- `app/main`: application setup, startup (captures the event loop for SSE), CORS, router registration
- `app/config`: settings loaded from environment
- `app/db`: Supabase client using the service key
- `app/deps`: current user (validates the token, loads the profile, rejects inactive), role guards (`technician_or_admin`, `admin_only`), scanner verification
- `app/errors`: error handlers that produce the standard format
- `app/routers`: `auth`, `assets`, `tickets`, `rfid`, `admin_users`, `admin_scanners`, `admin_audit`
- `app/services`: `rfid_utils`, `tap`, `events`, `gemini`, `priority`, `storage`, `snapshot`, `admin_users` (including safety rules), `audit`
- `scripts`: `seed` and `esp_simulator`
- `tests`: one file per service plus API-level tests for permissions

Run with a **single worker**. The SSE subscriber list is in memory.

---

## 17. Configuration

**Backend**

| Variable | Purpose |
|---|---|
| SUPABASE_URL | Project URL |
| SUPABASE_SERVICE_KEY | Service key. Backend only. Never expose |
| GEMINI_API_KEY | Gemini credentials |
| GEMINI_MODEL | Model name; confirm the current one before release |
| CORS_ORIGIN | Frontend origin |
| MAX_IMAGE_BYTES | Server-side image limit (default 1048576) |

**Frontend**

| Variable | Purpose |
|---|---|
| VITE_API_URL | Backend base URL |
| VITE_SUPABASE_URL | Project URL |
| VITE_SUPABASE_ANON_KEY | Anon key (safe for the browser because RLS denies direct access) |

Never commit real environment files.

---

## 18. Setup Instructions

**Supabase**
1. Create a Supabase project.
2. Run the schema scripts from task B1 (tables, indexes, triggers, row-level security, atomic resolve function).
3. Create the two private storage buckets: `ticket-images` and `asset-images`.
4. In Authentication, enable the Email provider. For development, turn off email confirmation.
5. **Bootstrap the first admin:** sign up through the app (or add a user in the Supabase dashboard), then open the `profiles` table and change that user's role to `admin`. This is the only time a role is set by hand. After that, create technicians and other admins from the admin console.
6. Copy the URL, anon key and service key into the environment files.

**Backend**
1. Create a virtual environment, install the dependencies, copy the example environment file and fill it in.
2. Run the seed script.
3. Start the server with a single worker. Open the `/docs` page to see the API.

**Frontend**
1. Install dependencies, copy the example environment file and fill it in.
2. Start the dev server and log in as the admin.

**Test the tap flow without hardware**
1. Run the ESP simulator with a seeded RFID, and the scanner code and key from the seed data.
2. Watch the technician dashboard update. Run it again to see the next mode.

---

## 19. Testing Plan

**Backend**
- Priority: scoring, safety boost, aging cap, override precedence
- RFID normalization: lowercase, colons, dashes, spaces
- Tap logic: unknown, archived, start, closeout (precedence over start), asset-only, debounce
- Status transitions: only the allowed path; resolve rejected unless `under_review`
- Resolve atomicity: incident, maintenance log, device update and history all written together, or none
- Tickets: image count, size and type; customers cannot read others' tickets; archived devices rejected
- **Permissions:** customer blocked from technician and admin endpoints; technician blocked from admin endpoints; inactive user blocked everywhere
- **Admin rules:** cannot delete or demote self; cannot remove the last admin; user with records cannot be deleted; device with history cannot be permanently deleted; audit entry written for each admin action; re-key cascades to tickets and history

**Frontend (manual checklist for V1)**
- Login and role redirects for all three roles
- Ticket form validation and compression
- All five tap panel modes using the simulator
- SSE reconnect after restarting the backend
- Admin: create each role, deactivate then try to log in, delete with and without records, archive and restore a device, rotate a scanner key

---

## 20. Task Board

Mark tasks `[x]` when complete and add owner initials.

### Backend

**B0. Setup**
- [ ] B0.1 Repo structure, dependency list, example environment file
- [ ] B0.2 Settings loader and Supabase client
- [ ] B0.3 CORS, health check, error handlers with the standard error format, logging

**B1. Database and storage**
- [ ] B1.1 Create tables from §12 (including `is_active`, archive fields, `admin_audit_log`)
- [ ] B1.2 Signup trigger that creates a customer profile
- [ ] B1.3 Indexes, `updated_at` trigger, row-level security on all tables
- [ ] B1.4 Foreign key rules: update cascade on RFID, no delete cascade on profiles or assets
- [ ] B1.5 Atomic resolve database function
- [ ] B1.6 Create the two private buckets
- [ ] B1.7 Seed script (admin, technician, customer, 4 devices, 1 scanner, history)

**B2. Auth and roles**
- [ ] B2.1 Current-user dependency (token validation, profile load, inactive check)
- [ ] B2.2 Role guards: `technician_or_admin`, `admin_only`
- [ ] B2.3 `GET /me`
- [ ] B2.4 Scanner verification with hashed key and active check

**B3. Assets API**
- [ ] B3.1 List and lookup (exclude archived)
- [ ] B3.2 Get, create, update
- [ ] B3.3 Device images (upload, delete, max 3)
- [ ] B3.4 History endpoint
- [ ] B3.5 Maintenance log endpoint
- [ ] B3.6 Archive and restore (admin)
- [ ] B3.7 Re-key (admin)
- [ ] B3.8 Permanent delete with the linked-records check and image cleanup (admin)

**B4. Tickets API**
- [ ] B4.1 Create ticket with validation (device exists and not archived, images)
- [ ] B4.2 Image upload and signed URLs
- [ ] B4.3 List (role-scoped, status filter, priority sort)
- [ ] B4.4 Detail
- [ ] B4.5 Priority override
- [ ] B4.6 Resolve through the database function
- [ ] B4.7 Transition guard and history writes

**B5. AI analysis**
- [ ] B5.1 Gemini integration with structured output and prompt
- [ ] B5.2 Background task after ticket creation
- [ ] B5.3 One retry and fallback
- [ ] B5.4 Store the raw response

**B6. Priority engine**
- [ ] B6.1 Base and effective priority functions
- [ ] B6.2 Queue sorting and unit tests

**B7. RFID tap**
- [ ] B7.1 Tap endpoint and RFID normalization
- [ ] B7.2 Decision logic for five modes and atomic start
- [ ] B7.3 Debounce
- [ ] B7.4 Payload builder with signed URLs
- [ ] B7.5 SSE publisher, stream endpoint (technician and admin), latest endpoint
- [ ] B7.6 ESP simulator

**B8. Admin: users**
- [ ] B8.1 List, detail with search and filters
- [ ] B8.2 Create user through the Supabase admin API, set role and profile
- [ ] B8.3 Edit name and role
- [ ] B8.4 Deactivate and reactivate (profile flag plus account suspension)
- [ ] B8.5 Reset password
- [ ] B8.6 Delete with the linked-records check
- [ ] B8.7 Safety rules: no self-action, keep one active admin

**B9. Admin: scanners and audit**
- [ ] B9.1 Scanner list, create (key shown once), edit, deactivate
- [ ] B9.2 Rotate key
- [ ] B9.3 Audit service called by every admin action
- [ ] B9.4 Audit log endpoint with filters and pagination

**B10. Quality**
- [ ] B10.1 Test suite from §19
- [ ] B10.2 Review the `/docs` output as the API contract

### Frontend

**F0. Setup**
- [ ] F0.1 Vite, React, Tailwind, Router, TanStack Query
- [ ] F0.2 API wrapper (token, 401 and 403 handling)
- [ ] F0.3 Three route groups: `/portal`, `/tech`, `/admin`

**F1. Auth**
- [ ] F1.1 Supabase client and auth provider
- [ ] F1.2 Login and signup pages
- [ ] F1.3 Role guard and redirect for three roles
- [ ] F1.4 Message shown to deactivated users

**F2. Customer portal**
- [ ] F2.1 Raise ticket form with dropdown and manual RFID toggle
- [ ] F2.2 2-image picker with previews and compression
- [ ] F2.3 My Tickets with stepper
- [ ] F2.4 Ticket detail with resolution

**F3. Technician dashboard**
- [ ] F3.1 Priority queue with filters and auto-refresh
- [ ] F3.2 Ticket detail
- [ ] F3.3 Priority override control

**F4. Live tap panel**
- [ ] F4.1 Live tap hook (latest on load, stale filter, stream)
- [ ] F4.2 Panel shell in the shared layout, connection badge
- [ ] F4.3 Start mode
- [ ] F4.4 Close-out mode
- [ ] F4.5 Asset-only mode
- [ ] F4.6 Unknown-tag mode with add-device shortcut
- [ ] F4.7 Archived-tag mode with admin-only restore
- [ ] F4.8 Switcher for other open tickets

**F5. Device management**
- [ ] F5.1 Device list and detail
- [ ] F5.2 Add and edit forms with photos
- [ ] F5.3 History timeline
- [ ] F5.4 Maintenance log form

**F6. Admin console**
- [ ] F6.1 Admin layout, navigation and overview
- [ ] F6.2 User list with search and filters
- [ ] F6.3 Create and edit user forms
- [ ] F6.4 Deactivate, reactivate, reset password, delete with confirmation and fallback to deactivation
- [ ] F6.5 Admin device controls: archived filter, archive, restore, delete, re-key
- [ ] F6.6 Scanner management with the one-time key dialog
- [ ] F6.7 Audit log view

**F7. Polish**
- [ ] F7.1 Loading, empty and error states
- [ ] F7.2 Toasts and confirmation dialogs
- [ ] F7.3 Mobile layout for customer pages

### Cross-cutting
- [ ] X1 README with setup steps, including the admin bootstrap
- [ ] X2 Optional container setup for backend and frontend
- [ ] X3 API contract review before frontend integration
- [ ] X4 Git conventions and PR template
- [ ] X5 Demo script and demo data

---

## 21. Milestones

| Milestone | Tasks | Outcome |
|---|---|---|
| **M1 Foundation** | B0, B1, B2, F0, F1 | Supabase Auth with three roles working, database and buckets ready |
| **M2 Admin and devices** | B3, B8, B9, F5, F6 | Admin manages users, scanners and devices; technician adds and edits devices |
| **M3 Tickets** | B4, F2, F3 | Customers raise tickets and they appear in the queue |
| **M4 AI and priority** | B5, B6 | Auto-prioritized queue |
| **M5 RFID workflow** | B7, F4 | Tap 1 starts work, tap 2 opens close-out |
| **M6 Hardening** | B10, F7, X1–X5 | Demo-ready and documented |

Suggested split for a small team: one person on backend (B0–B2 first), one on frontend (F0–F1 first). Agree on §14 before M2 so both sides can build in parallel.

---

## 22. Team Guidelines

**Branching**
- `main` is always demo-ready; `develop` is the integration branch.
- Feature branches use the task ID, for example `feature/B8-admin-users` or `feature/F6-admin-console`.
- Fixes use `fix/<short-description>`.

**Commits and pull requests**
- Conventional commit prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- One task ID per PR where possible, with at least one reviewer.
- PR checklist: tests added or updated, `/docs` still accurate, no secrets, no leftover debug output, screenshots for UI changes, permissions checked for every new endpoint.

**Standards**
- Business rules live in services, not routers.
- Every new endpoint must declare its access level (public, any user, technician or admin, admin only, device).
- Always normalize RFID input before comparing or storing.
- Server state on the frontend goes through TanStack Query and the shared API wrapper.
- All timestamps in UTC.

**Security rules**
- Service key and Gemini key only in backend configuration.
- Never trust the role from the frontend or from the token; read it from `profiles`.
- Admin actions must write an audit entry.
- Treat AI output as advisory and validate it against the schema.

**Definition of done for a task**
- Works end to end locally, tests pass, reviewed and merged, task ticked in §20, and any API change reflected in §14.

---

## 23. Acceptance Criteria and Demo Scenario

**Version 1 is accepted when all of the following pass:**

1. The admin logs in, creates a technician account and a customer account, and both can log in.
2. The admin adds a new device with an RFID and photos. The technician can also add and edit devices.
3. The customer selects the device (dropdown or typed RFID) and raises a ticket with 2 small images. It shows **Pending Review**.
4. Within seconds the ticket shows an AI severity and appears at the correct position in the technician queue. If Gemini is unavailable, the fallback values appear instead.
5. The technician taps the card. The ticket becomes **Under Review** and the dashboard instantly shows the customer's complaint, images and date/time.
6. After the repair, the technician taps again, completes the close-out form and submits. The ticket becomes **Resolved**, and the customer sees the resolution.
7. A third tap shows the device with the new incident in its history.
8. Tapping an unregistered card shows "Unknown tag" with an add-device shortcut.
9. The admin archives a device. It disappears from the customer dropdown, a tap shows "Device archived", and the admin can restore it.
10. The admin tries to delete a user who has tickets and is told to deactivate instead. The deactivated user can no longer use the system.
11. The admin cannot delete or demote their own account, and cannot remove the last admin.
12. A customer cannot open any technician or admin page or endpoint, and a technician cannot open any admin page or endpoint.
13. The audit log shows every admin action performed above.

---

## 24. Assumptions and Open Questions

**Confirmed decisions**
- Supabase Auth; three roles: customer, technician, admin (super admin).
- Device selection by dropdown or manual RFID entry.
- Technician can add and edit devices, including images and dates.
- Maximum 2 compressed images per ticket.
- Three ticket states; tap starts work, close-out form resolves.
- RFID UID is the primary key.
- SSE instead of polling or WebSockets.

**Assumptions in this document (please review)**

| # | Assumption |
|---|---|
| A1 | Only the tap moves a ticket to `under_review`; opening a ticket on screen does not |
| A2 | On `start`, the customer's complaint leads; device history is secondary |
| A3 | Tap 2 only opens the close-out form; submitting it resolves the ticket |
| A4 | With several open tickets, the tap acts on the highest-priority one and lists the rest |
| A5 | Customers self-register; **technicians and admins are created by an admin** |
| A6 | A device with one `under_review` and one `pending_review` ticket continues the `under_review` job on tap |
| A7 | Priority weights (60% AI, criticality up to 30, safety +25, aging +0.1 per hour up to +10) are starting values |
| A8 | Taps are not tied to a specific technician in V1; they show on every open technician or admin dashboard |
| **A9** | Admin inherits every technician ability, including the live tap panel and resolving tickets |
| **A10** | "Delete" defaults to **archive / deactivate** to protect history; permanent delete is allowed only when there are no linked records |
| **A11** | Admin can also manage scanners, since the device key must exist for taps to work |
| **A12** | Admins do not raise tickets; ticket creation is for customers |
| **A13** | Admin sets the initial password when creating a user; email invitations are out of scope for V1 |

**Open questions**
- **Q1.** Should device creation be **admin only**, or stay open to technicians as decided earlier?
- **Q2.** Is the archive-first approach for devices and users acceptable, or do you need to hard delete records that have history (which would also erase the history)?
- **Q3.** Should admins be able to raise tickets on behalf of a customer?
- **Q4.** Should the ticket detail page offer an "Open close-out" button as a fallback if the dashboard missed the second tap?
- **Q5.** Should customers get an email when their ticket changes status? Currently out of scope.
- **Q6.** Hosting target for the demo: local only, or deployed? The single-worker SSE rule affects the choice of host.

---

## 25. Roadmap (V2 and Beyond)

- Realtime through Supabase Realtime or Redis so the backend can run several workers
- Multiple technicians with tap routing, assignment and shift handling
- A fourth role for read-only managers
- Email invitations and password-reset emails
- HMAC request signing and replay protection for the ESP
- SLA timers, escalation, and email, WhatsApp or Telegram notifications
- Vector search over past incidents ("this looks like incident #482")
- Predictive maintenance from incident history
- QR code scanning on the ticket form
- Mobile app or PWA for technicians
- Multi-site and multi-tenant support
- Reports and dashboards (time to resolve, failure rate per device, SLA compliance)
- Bulk import of devices and users
