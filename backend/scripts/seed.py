"""
Seed script for DEAM backend.
Creates: 1 admin, 1 technician, 1 customer, 4 assets, 1 scanner, historical data.
Run from the backend/ directory: python -m scripts.seed
Requires .env to be populated.
"""
import os
import sys
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

TEST_PASSWORD = "TestPass-2026!"

USERS = [
    {"email": "admin@deam.local", "full_name": "Admin User", "role": "admin"},
    {"email": "tech@deam.local", "full_name": "Ravi Kumar", "role": "technician"},
    {"email": "customer@deam.local", "full_name": "Priya Sharma", "role": "customer"},
]

ASSETS = [
    {
        "rfid_uid": "04A3B2C1",
        "name": "Conveyor Motor Alpha",
        "model": "XM-400",
        "serial_no": "SN-100234",
        "location": "Line 1",
        "criticality": 4,
        "status": "active",
        "install_date": "2023-01-15",
        "warranty_expiry": "2026-01-15",
        "last_service_date": "2026-08-10",
        "next_service_due": "2027-02-10",
        "notes": "Runs 16 hours per day",
    },
    {
        "rfid_uid": "04D4E5F6",
        "name": "Hydraulic Press Beta",
        "model": "HP-200",
        "serial_no": "SN-200155",
        "location": "Line 2",
        "criticality": 5,
        "status": "active",
        "install_date": "2022-06-01",
        "warranty_expiry": "2025-06-01",
        "last_service_date": "2026-07-20",
        "next_service_due": "2026-12-20",
        "notes": "High pressure system; inspect monthly",
    },
    {
        "rfid_uid": "04778899",
        "name": "Cooling Tower Unit C",
        "model": "CT-150",
        "serial_no": "SN-300001",
        "location": "Roof",
        "criticality": 3,
        "status": "active",
        "install_date": "2024-03-10",
        "warranty_expiry": "2027-03-10",
        "last_service_date": "2026-09-05",
        "next_service_due": "2027-03-05",
        "notes": "",
    },
    {
        "rfid_uid": "04AABBCC",
        "name": "Air Compressor Delta",
        "model": "AC-75HP",
        "serial_no": "SN-400022",
        "location": "Utility Room",
        "criticality": 2,
        "status": "active",
        "install_date": "2023-11-01",
        "warranty_expiry": "2026-11-01",
        "last_service_date": "2026-10-01",
        "next_service_due": "2027-04-01",
        "notes": "Filter replaced Oct 2026",
    },
]

SCANNER_CODE = "SCN-001"
SCANNER_KEY = "deam-test-key-do-not-use-in-production"


def normalize_rfid(raw: str) -> str:
    import re
    return re.sub(r'[:\-\s]', '', raw).upper()


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def create_or_get_user(email: str, full_name: str, role: str) -> str:
    """Create user via admin API; return user ID."""
    # Try to get existing
    try:
        # List users (simple approach: create and handle duplicate)
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": TEST_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        })
        user_id = str(res.user.id)
        print(f"  Created auth user: {email} -> {user_id}")
    except Exception as e:
        if "already" in str(e).lower() or "duplicate" in str(e).lower() or "exists" in str(e).lower():
            # Fetch by listing (admin API)
            users_res = supabase.auth.admin.list_users()
            for u in users_res:
                if hasattr(u, 'email') and u.email == email:
                    user_id = str(u.id)
                    print(f"  Found existing user: {email} -> {user_id}")
                    break
            else:
                raise ValueError(f"Cannot find existing user {email}")
        else:
            raise

    # Upsert profile with correct role
    supabase.table("profiles").upsert({
        "id": user_id,
        "full_name": full_name,
        "role": role,
        "is_active": True,
    }).execute()
    return user_id


def seed_users() -> dict[str, str]:
    print("\n[1/5] Seeding users...")
    ids = {}
    for u in USERS:
        uid = create_or_get_user(u["email"], u["full_name"], u["role"])
        ids[u["role"]] = uid
    return ids


def seed_assets(admin_id: str) -> None:
    print("\n[2/5] Seeding assets...")
    for asset in ASSETS:
        a = {**asset, "rfid_uid": normalize_rfid(asset["rfid_uid"]), "created_by": admin_id}
        existing = supabase.table("assets").select("rfid_uid").eq("rfid_uid", a["rfid_uid"]).execute()
        if existing.data:
            print(f"  Asset {a['rfid_uid']} already exists, skipping")
            continue
        supabase.table("assets").insert(a).execute()
        print(f"  Created asset: {a['name']} ({a['rfid_uid']})")


def seed_scanner(admin_id: str) -> None:
    print("\n[3/5] Seeding scanner...")
    existing = supabase.table("scanners").select("id").eq("scanner_code", SCANNER_CODE).execute()
    if existing.data:
        print(f"  Scanner {SCANNER_CODE} already exists")
        return
    supabase.table("scanners").insert({
        "id": str(uuid.uuid4()),
        "scanner_code": SCANNER_CODE,
        "api_key_hash": hash_key(SCANNER_KEY),
        "location": "Line 1 Station",
        "is_active": True,
        "created_by": admin_id,
    }).execute()
    print(f"  Created scanner: {SCANNER_CODE}")
    print(f"  Test device key: {SCANNER_KEY}")


def seed_history(admin_id: str, tech_id: str) -> None:
    print("\n[4/5] Seeding historical data...")
    rfid = normalize_rfid("04A3B2C1")
    # Past incident
    inc_res = supabase.table("incidents").select("id").eq("asset_rfid", rfid).limit(1).execute()
    if not inc_res.data:
        three_months_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        supabase.table("incidents").insert({
            "asset_rfid": rfid,
            "summary": "Motor overheated during peak load",
            "root_cause": "Worn cooling fan",
            "resolution": "Replaced cooling fan and cleaned vents",
            "parts_replaced": [{"name": "Cooling Fan 120mm", "qty": 1}],
            "occurred_at": three_months_ago,
            "resolved_at": three_months_ago,
            "created_by": tech_id,
        }).execute()
        print(f"  Created historical incident for {rfid}")

    # Past maintenance log
    maint_res = supabase.table("maintenance_logs").select("id").eq("asset_rfid", rfid).limit(1).execute()
    if not maint_res.data:
        two_months_ago = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        supabase.table("maintenance_logs").insert({
            "asset_rfid": rfid,
            "type": "preventive",
            "report": "Routine PM: lubricated bearings, checked alignment, replaced filters",
            "parts_replaced": [{"name": "Oil Filter", "qty": 2}],
            "performed_by": tech_id,
            "performed_at": two_months_ago,
            "next_due_date": "2027-02-10",
        }).execute()
        print(f"  Created maintenance log for {rfid}")


def print_summary(user_ids: dict) -> None:
    print("\n[5/5] Seed complete!")
    print("\n=== Test Credentials ===")
    for u in USERS:
        role = u["role"]
        print(f"  {role.capitalize()}: {u['email']} / {TEST_PASSWORD}  (ID: {user_ids.get(role, 'N/A')})")
    print(f"\n=== Scanner ===")
    print(f"  Code: {SCANNER_CODE}")
    print(f"  Key:  {SCANNER_KEY}")
    print(f"\n=== Assets (RFID UIDs) ===")
    for a in ASSETS:
        print(f"  {normalize_rfid(a['rfid_uid'])}: {a['name']}")
    print("\nUse these values in the ESP simulator to test tap flows.")


if __name__ == "__main__":
    try:
        user_ids = seed_users()
        seed_assets(user_ids["admin"])
        seed_scanner(user_ids["admin"])
        seed_history(user_ids["admin"], user_ids["technician"])
        print_summary(user_ids)
    except Exception as e:
        print(f"\nSeed FAILED: {e}")
        sys.exit(1)
