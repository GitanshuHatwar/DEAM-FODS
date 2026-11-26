# Supabase Setup Guide — DEAM Industrial Ticketing System

---

## Section 1: Prerequisites

Before you begin, ensure you have:

- A [Supabase](https://supabase.com) account (free tier is sufficient for development)
- Access to the Supabase dashboard
- The project's backend `.env` file ready to fill in after setup

This guide walks you through creating the project, configuring storage buckets, running the full database schema, applying triggers and indexes, enabling Row-Level Security, and bootstrapping the first admin user.

---

## Section 2: Create Project & Buckets

### 2.1 Create a New Supabase Project

1. Log in at [https://app.supabase.com](https://app.supabase.com)
2. Click **New project**
3. Fill in:
   - **Name**: `deam-ticketing` (or your preference)
   - **Database Password**: choose a strong password and save it somewhere safe
   - **Region**: pick the region closest to your users
4. Click **Create new project** and wait for provisioning (~1–2 minutes)

After creation, navigate to **Project Settings → API** and copy:
- **Project URL** → `SUPABASE_URL` in `.env`
- **service_role** secret key → `SUPABASE_SERVICE_KEY` in `.env`
- **anon** public key → `VITE_SUPABASE_ANON_KEY` in frontend `.env.local`

### 2.2 Create Storage Buckets

Go to **Storage** in the left sidebar and create two **private** buckets:

| Bucket Name     | Public? |
|-----------------|---------|
| `ticket-images` | ❌ No   |
| `asset-images`  | ❌ No   |

For each bucket:
1. Click **New bucket**
2. Enter the bucket name exactly as shown above
3. Leave **Public bucket** toggle **OFF**
4. Click **Create bucket**

### 2.3 Disable Email Confirmation (Development Only)

> [!WARNING]
> Only disable this for development. Re-enable it before going to production.

1. Go to **Authentication → Providers → Email**
2. Toggle **Confirm email** to **OFF**
3. Click **Save**

---

## Section 3: Run Schema SQL

Open the **SQL Editor** in your Supabase dashboard (**SQL Editor → New query**) and run the following SQL in one block:

```sql
-- 1. profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','technician','admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. assets (devices; rfid_uid is PK)
CREATE TABLE assets (
  rfid_uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT,
  serial_no TEXT,
  location TEXT,
  criticality INT NOT NULL DEFAULT 3 CHECK (criticality BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','under_maintenance','retired')),
  install_date DATE,
  warranty_expiry DATE,
  last_service_date DATE,
  next_service_due DATE,
  notes TEXT,
  specs JSONB DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. asset_images
CREATE TABLE asset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_rfid TEXT NOT NULL REFERENCES assets(rfid_uid) ON UPDATE CASCADE ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. scanners
CREATE TABLE scanners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_code TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. tickets
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_rfid TEXT NOT NULL REFERENCES assets(rfid_uid) ON UPDATE CASCADE ON DELETE RESTRICT,
  raised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','under_review','resolved')),
  ai_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending','done','fallback')),
  ai_severity TEXT CHECK (ai_severity IN ('critical','high','medium','low')),
  ai_score INT CHECK (ai_score BETWEEN 0 AND 100),
  ai_safety_risk BOOLEAN DEFAULT false,
  ai_probable_cause TEXT,
  ai_summary TEXT,
  ai_raw JSONB,
  priority_score NUMERIC DEFAULT 50,
  priority_override NUMERIC,
  started_at TIMESTAMPTZ,
  started_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ticket_images
CREATE TABLE ticket_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ticket_status_history
CREATE TABLE ticket_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  via TEXT NOT NULL CHECK (via IN ('tap','form','system')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_rfid TEXT NOT NULL REFERENCES assets(rfid_uid) ON UPDATE CASCADE ON DELETE RESTRICT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE RESTRICT,
  summary TEXT NOT NULL,
  root_cause TEXT,
  resolution TEXT,
  parts_replaced JSONB DEFAULT '[]',
  occurred_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. maintenance_logs
CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_rfid TEXT NOT NULL REFERENCES assets(rfid_uid) ON UPDATE CASCADE ON DELETE RESTRICT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('preventive','corrective','inspection')),
  report TEXT,
  parts_replaced JSONB DEFAULT '[]',
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL,
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. rfid_events
CREATE TABLE rfid_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_id UUID REFERENCES scanners(id) ON DELETE SET NULL,
  rfid_uid TEXT NOT NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('started','closeout_opened','asset_viewed','unknown_tag','archived_tag')),
  tapped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. admin_audit_log
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Section 4: Triggers

Run the following SQL in the **SQL Editor**:

```sql
-- Auto-create customer profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'customer',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- updated_at trigger for assets
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
```

> [!NOTE]
> `handle_new_user` runs as `SECURITY DEFINER` so it can insert into `profiles` from the auth schema trigger context. The `set_updated_at` trigger keeps `assets.updated_at` accurate on every row update automatically.

---

## Section 5: Indexes

Run the following SQL to create all performance indexes:

```sql
-- Tickets
CREATE INDEX idx_tickets_status_priority ON tickets (status, priority_score DESC);
CREATE INDEX idx_tickets_asset ON tickets (asset_rfid);
CREATE INDEX idx_tickets_raised_by ON tickets (raised_by);
CREATE INDEX idx_tickets_created_at ON tickets (created_at);

-- Incidents & maintenance
CREATE INDEX idx_incidents_asset_date ON incidents (asset_rfid, occurred_at DESC);
CREATE INDEX idx_maintenance_asset_date ON maintenance_logs (asset_rfid, performed_at DESC);

-- RFID events (debounce query)
CREATE INDEX idx_rfid_events_scanner_rfid_time ON rfid_events (scanner_id, rfid_uid, tapped_at DESC);

-- Audit log
CREATE INDEX idx_audit_log_time ON admin_audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON admin_audit_log (actor_id);

-- Asset images
CREATE INDEX idx_asset_images_rfid ON asset_images (asset_rfid);

-- Scanners
CREATE UNIQUE INDEX idx_scanners_code ON scanners (scanner_code);
```

---

## Section 6: Row-Level Security (Deny All)

> [!IMPORTANT]
> The backend exclusively uses the **service role key**, which bypasses RLS entirely. The **anon key** (used in the browser) will be blocked from reading or writing any table directly. Never expose the service key to the frontend.

Run the following SQL to enable RLS on all tables with no permissive policies (deny-by-default):

```sql
-- Enable RLS on all tables (deny-by-default; backend uses service key which bypasses RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies are added. The service key (used only by the backend) bypasses RLS.
-- The anon key (used by the browser) cannot read or write any table directly.
```

---

## Section 7: Atomic Resolve Function

This stored procedure resolves a ticket atomically — it updates the ticket, writes status history, creates an incident record, creates a maintenance log, and updates the asset in a single transaction. Run it in the **SQL Editor**:

```sql
CREATE OR REPLACE FUNCTION resolve_ticket(
  p_ticket_id UUID,
  p_resolved_by UUID,
  p_root_cause TEXT,
  p_resolution TEXT,
  p_parts_replaced JSONB,
  p_report TEXT,
  p_asset_status TEXT,
  p_next_service_due DATE,
  p_notes TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_asset  assets%ROWTYPE;
  v_incident_id UUID;
  v_mlog_id UUID;
BEGIN
  -- Lock and fetch ticket
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: ticket % does not exist', p_ticket_id;
  END IF;

  IF v_ticket.status != 'under_review' THEN
    RAISE EXCEPTION 'invalid_transition: ticket is %, expected under_review', v_ticket.status;
  END IF;

  SELECT * INTO v_asset FROM assets WHERE rfid_uid = v_ticket.asset_rfid;

  -- 1. Mark ticket resolved
  UPDATE tickets SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by = p_resolved_by
  WHERE id = p_ticket_id;

  -- 2. Write status history
  INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, via)
  VALUES (p_ticket_id, 'under_review', 'resolved', p_resolved_by, 'form');

  -- 3. Write incident
  INSERT INTO incidents (asset_rfid, ticket_id, summary, root_cause, resolution, parts_replaced, occurred_at, resolved_at, created_by)
  VALUES (
    v_ticket.asset_rfid,
    p_ticket_id,
    v_ticket.title,
    p_root_cause,
    p_resolution,
    p_parts_replaced,
    v_ticket.occurred_at,
    now(),
    p_resolved_by
  )
  RETURNING id INTO v_incident_id;

  -- 4. Write maintenance log
  INSERT INTO maintenance_logs (asset_rfid, ticket_id, type, report, parts_replaced, performed_by, performed_at, next_due_date)
  VALUES (
    v_ticket.asset_rfid,
    p_ticket_id,
    'corrective',
    p_report,
    p_parts_replaced,
    p_resolved_by,
    now(),
    p_next_service_due
  )
  RETURNING id INTO v_mlog_id;

  -- 5. Update asset
  UPDATE assets SET
    status = COALESCE(NULLIF(p_asset_status, ''), status),
    next_service_due = COALESCE(p_next_service_due, next_service_due),
    last_service_date = CURRENT_DATE,
    notes = COALESCE(NULLIF(p_notes, ''), notes),
    updated_at = now()
  WHERE rfid_uid = v_ticket.asset_rfid;

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'incident_id', v_incident_id,
    'maintenance_log_id', v_mlog_id
  );
END;
$$;
```

> [!TIP]
> Call this function from the backend via `supabase.rpc('resolve_ticket', { p_ticket_id: ..., ... })`. It uses `FOR UPDATE` locking to prevent race conditions if two technicians attempt to resolve the same ticket simultaneously.

---

## Section 8: Bootstrap First Admin

After creating the project, you need to manually promote the first user to `admin` role since the sign-up trigger always assigns `customer`.

**Step 1**: Sign up normally through the app (or Supabase Auth dashboard: **Authentication → Users → Invite user**).

**Step 2**: Copy the UUID of that user from **Authentication → Users**.

**Step 3**: Open the **SQL Editor** and run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = '<paste-your-user-uuid-here>';
```

**Step 4**: Verify it worked:

```sql
SELECT id, full_name, role, is_active FROM profiles WHERE role = 'admin';
```

> [!CAUTION]
> Only perform this update using the Supabase dashboard SQL Editor or a trusted server-side context. Never expose an endpoint that allows arbitrary role promotion.

From this point on, the admin user can create technician and other admin accounts through the application's admin panel (which calls the backend API, which uses the service key).

---

## Section 9: Verify Setup

Run these queries in the **SQL Editor** to confirm everything is in order.

### 9.1 Confirm all tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables (11):

```
admin_audit_log
asset_images
assets
incidents
maintenance_logs
profiles
rfid_events
scanners
ticket_images
ticket_status_history
tickets
```

### 9.2 Confirm RLS is enabled on all tables

```sql
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
ORDER BY relname;
```

All rows should show `rls_enabled = true`.

### 9.3 Confirm triggers exist

```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth')
ORDER BY trigger_name;
```

Expected triggers:
- `on_auth_user_created` on `auth.users`
- `assets_updated_at` on `assets`

### 9.4 Confirm indexes exist

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

### 9.5 Confirm the resolve_ticket function exists

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('resolve_ticket', 'handle_new_user', 'set_updated_at');
```

### 9.6 Confirm storage buckets exist

```sql
SELECT name, public
FROM storage.buckets
ORDER BY name;
```

Expected:
```
asset-images  | false
ticket-images | false
```

---

*Setup complete. Fill in `backend/.env` with your project URL and service key, then start the backend server.*
