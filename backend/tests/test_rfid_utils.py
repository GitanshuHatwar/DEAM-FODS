"""Unit tests for RFID normalization."""
import pytest
from app.services.rfid_utils import normalize_rfid


class TestNormalizeRFID:
    def test_already_normalized(self):
        assert normalize_rfid("04A3B2C1") == "04A3B2C1"

    def test_lowercase_to_upper(self):
        assert normalize_rfid("04a3b2c1") == "04A3B2C1"

    def test_removes_colons(self):
        assert normalize_rfid("04:a3:b2:c1") == "04A3B2C1"

    def test_removes_dashes(self):
        assert normalize_rfid("04-A3-B2-C1") == "04A3B2C1"

    def test_removes_spaces(self):
        assert normalize_rfid("04 A3 B2 C1") == "04A3B2C1"

    def test_mixed_separators(self):
        assert normalize_rfid("04:a3-B2 c1") == "04A3B2C1"

    def test_empty_string(self):
        assert normalize_rfid("") == ""

    def test_no_separators_lowercase(self):
        assert normalize_rfid("04a3b2c1ff") == "04A3B2C1FF"
