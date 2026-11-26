"""
Shared pytest fixtures.
Tests use a real Supabase test project (integration tests).
Unit tests for pure functions do not need the client.
"""
import os
import pytest
from pathlib import Path

# Load .env if it exists
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass
