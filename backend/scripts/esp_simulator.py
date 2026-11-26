"""
ESP Simulator — sends tap requests to the backend tap endpoint.
Cycles through 5 tap modes when run repeatedly.

Usage:
  python -m scripts.esp_simulator [--rfid RFID] [--url URL]

Environment variables (overrides):
  ESP_API_URL   - Backend URL (default: http://localhost:8000)
  ESP_RFID      - RFID to tap (default: 04A3B2C1)
  ESP_SCANNER   - Scanner code (default: SCN-001)
  ESP_KEY       - Device key (default: deam-test-key-do-not-use-in-production)
"""
import argparse
import os
import sys
from pathlib import Path
import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))

API_URL = os.environ.get("ESP_API_URL", "http://localhost:8000")
RFID = os.environ.get("ESP_RFID", "04A3B2C1")
SCANNER_CODE = os.environ.get("ESP_SCANNER", "SCN-001")
DEVICE_KEY = os.environ.get("ESP_KEY", "deam-test-key-do-not-use-in-production")


def tap(rfid: str, scanner_code: str, device_key: str, api_url: str) -> None:
    url = f"{api_url}/rfid/tap"
    headers = {"X-Device-Key": device_key, "Content-Type": "application/json"}
    payload = {"rfid_uid": rfid, "scanner_id": scanner_code}
    print(f"\n[ESP Simulator] POST {url}")
    print(f"  RFID: {rfid}")
    print(f"  Scanner: {scanner_code}")
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=10)
        print(f"  Status: {resp.status_code}")
        try:
            print(f"  Response: {resp.json()}")
        except Exception:
            print(f"  Response: {resp.text}")
    except httpx.ConnectError:
        print(f"  ERROR: Cannot connect to {api_url}. Is the backend running?")
    except Exception as e:
        print(f"  ERROR: {e}")


def main():
    parser = argparse.ArgumentParser(description="ESP RFID Tap Simulator")
    parser.add_argument("--rfid", default=RFID, help="RFID UID to tap")
    parser.add_argument("--url", default=API_URL, help="Backend API URL")
    parser.add_argument("--scanner", default=SCANNER_CODE, help="Scanner code")
    parser.add_argument("--key", default=DEVICE_KEY, help="Device key")
    args = parser.parse_args()

    tap(args.rfid, args.scanner, args.key, args.url)


if __name__ == "__main__":
    main()
