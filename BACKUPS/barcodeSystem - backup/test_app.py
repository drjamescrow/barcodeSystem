#!/usr/bin/env python3
"""
Test script for the Label Generator application
"""

import requests
import os
import sys

def test_local_app():
    """Test the application running locally"""
    base_url = "http://localhost:5000"

    print("🧪 Testing Label Generator Application")
    print("=" * 50)

    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health check: PASS")
        else:
            print(f"❌ Health check: FAIL ({response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check: FAIL (Connection error: {e})")
        print("💡 Make sure the app is running with: python app.py")
        return False

    # Test main page
    try:
        response = requests.get(base_url, timeout=10)
        if response.status_code == 200 and "Label Generator" in response.text:
            print("✅ Main page: PASS")
        else:
            print(f"❌ Main page: FAIL ({response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Main page: FAIL ({e})")
        return False

    # Test file upload with sample Excel file
    if os.path.exists("shirt_orders.xlsx"):
        try:
            with open("shirt_orders.xlsx", "rb") as f:
                files = {"file": ("shirt_orders.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                response = requests.post(f"{base_url}/upload", files=files, timeout=30)

            if response.status_code == 200:
                label_count = response.headers.get('X-Label-Count', 'unknown')
                print(f"✅ File upload: PASS (Generated {label_count} labels)")
                print(f"📄 PDF size: {len(response.content)} bytes")
            else:
                print(f"❌ File upload: FAIL ({response.status_code})")
                if response.headers.get('content-type', '').startswith('application/json'):
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', 'Unknown error')}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"❌ File upload: FAIL ({e})")
            return False
    else:
        print("⚠️  File upload test skipped (shirt_orders.xlsx not found)")

    print("\n🎉 All tests passed!")
    return True

if __name__ == "__main__":
    success = test_local_app()
    sys.exit(0 if success else 1)