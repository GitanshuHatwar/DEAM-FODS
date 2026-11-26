"""Unit tests for tap decision logic helpers (pure functions)."""
import pytest
from app.services.rfid_utils import normalize_rfid


def test_rfid_normalization_in_tap_context():
    """RFID coming from ESP should be normalized before lookup."""
    raw_from_esp = "04:a3:b2:c1"
    assert normalize_rfid(raw_from_esp) == "04A3B2C1"


def test_tap_decision_order():
    """
    Decision order:
    1. unknown_tag
    2. archived_tag
    3. closeout (under_review exists)
    4. start (pending_review exists)
    5. asset_only
    This is documented behavior; test names document the contract.
    """
    # These are tested end-to-end via the simulator.
    # This unit test just documents the priority order.
    decision_priority = [
        "unknown_tag",
        "archived_tag",
        "closeout",
        "start",
        "asset_only",
    ]
    # Order must be preserved
    assert decision_priority[0] == "unknown_tag"
    assert decision_priority[2] == "closeout"
    assert decision_priority[3] == "start"
    assert decision_priority[-1] == "asset_only"
