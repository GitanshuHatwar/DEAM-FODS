"""Unit tests for priority scoring functions."""
import pytest
from datetime import datetime, timezone, timedelta
from app.services.priority import compute_base_priority, compute_effective_priority


class TestBasePriority:
    def test_all_zeros(self):
        # 0.6*0 + 6*1 + 0 = 6
        assert compute_base_priority(0, 1, False) == pytest.approx(6.0)

    def test_max_capped_at_100(self):
        result = compute_base_priority(100, 5, True)
        assert result == 100.0

    def test_safety_risk_adds_25(self):
        base_no_risk = compute_base_priority(50, 3, False)
        base_with_risk = compute_base_priority(50, 3, True)
        assert base_with_risk - base_no_risk == pytest.approx(25.0)

    def test_criticality_weight_6(self):
        # 6 * criticality contributes
        low = compute_base_priority(0, 1, False)
        high = compute_base_priority(0, 5, False)
        assert high - low == pytest.approx(24.0)

    def test_ai_score_weight_60_percent(self):
        # 0.6 * 100 = 60; criticality 1 -> +6 = 66
        result = compute_base_priority(100, 1, False)
        assert result == pytest.approx(66.0)

    def test_typical_critical_ticket(self):
        # ai_score=90, criticality=5, safety=True -> 0.6*90 + 6*5 + 25 = 54+30+25=109 -> capped 100
        result = compute_base_priority(90, 5, True)
        assert result == 100.0

    def test_low_priority_ticket(self):
        # ai_score=20, criticality=1, safety=False -> 0.6*20 + 6 = 12+6=18
        result = compute_base_priority(20, 1, False)
        assert result == pytest.approx(18.0)


class TestEffectivePriority:
    def test_override_takes_precedence(self):
        created = datetime.now(timezone.utc) - timedelta(hours=100)
        result = compute_effective_priority(80.0, created, override=42.5)
        assert result == pytest.approx(42.5)

    def test_override_zero_is_valid(self):
        created = datetime.now(timezone.utc)
        result = compute_effective_priority(80.0, created, override=0.0)
        assert result == pytest.approx(0.0)

    def test_aging_adds_0_1_per_hour(self):
        created = datetime.now(timezone.utc) - timedelta(hours=10)
        result = compute_effective_priority(50.0, created, override=None)
        # aging = 10 * 0.1 = 1.0
        assert result == pytest.approx(51.0, abs=0.2)

    def test_aging_capped_at_10(self):
        created = datetime.now(timezone.utc) - timedelta(hours=200)
        result = compute_effective_priority(50.0, created, override=None)
        # aging capped at 10
        assert result == pytest.approx(60.0, abs=0.2)

    def test_no_override_uses_base_plus_aging(self):
        created = datetime.now(timezone.utc) - timedelta(hours=5)
        result = compute_effective_priority(70.0, created, override=None)
        # 70 + 5*0.1 = 70.5
        assert result == pytest.approx(70.5, abs=0.2)

    def test_naive_datetime_handled(self):
        # Should not raise
        created = datetime.now() - timedelta(hours=1)
        result = compute_effective_priority(50.0, created, override=None)
        assert result > 50.0
