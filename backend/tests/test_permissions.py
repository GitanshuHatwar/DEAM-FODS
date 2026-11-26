"""
Permission boundary unit tests (documented contract).
Full API-level tests require a running server + Supabase; these document expectations.
"""
import pytest


CUSTOMER_FORBIDDEN_PATHS = [
    "GET /assets/{rfid}",
    "POST /assets",
    "PATCH /assets/{rfid}",
    "POST /assets/{rfid}/archive",
    "POST /assets/{rfid}/restore",
    "POST /assets/{rfid}/rekey",
    "DELETE /assets/{rfid}",
    "GET /tickets (all)",
    "PATCH /tickets/{id}/priority",
    "POST /tickets/{id}/resolve",
    "GET /rfid/stream",
    "GET /rfid/latest",
    "GET /admin/users",
    "POST /admin/users",
]

TECHNICIAN_FORBIDDEN_PATHS = [
    "POST /assets/{rfid}/archive",
    "POST /assets/{rfid}/restore",
    "POST /assets/{rfid}/rekey",
    "DELETE /assets/{rfid}",
    "GET /admin/users",
    "POST /admin/users",
    "PATCH /admin/users/{id}",
    "POST /admin/users/{id}/deactivate",
    "DELETE /admin/users/{id}",
    "GET /admin/scanners",
    "POST /admin/scanners",
    "POST /admin/scanners/{id}/rotate-key",
    "GET /admin/audit-log",
]

ADMIN_ALLOWED_BUT_NOT_SELF_MODIFY = [
    "DELETE /admin/users/{own_id}",
    "POST /admin/users/{own_id}/deactivate",
    "PATCH /admin/users/{own_id} with role demotion",
]


def test_customer_forbidden_list_is_defined():
    assert len(CUSTOMER_FORBIDDEN_PATHS) > 0


def test_technician_cannot_access_admin_routes():
    admin_routes = [p for p in TECHNICIAN_FORBIDDEN_PATHS if "/admin/" in p]
    assert len(admin_routes) > 5


def test_admin_self_protection_documented():
    assert any("own_id" in p for p in ADMIN_ALLOWED_BUT_NOT_SELF_MODIFY)
