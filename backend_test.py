#!/usr/bin/env python3
"""
Fractal Platform Backend API Testing
Tests all endpoints mentioned in the review request.
"""

import requests
import sys
import json
from datetime import datetime

class FractalPlatformTester:
    def __init__(self, base_url="https://forex-fractal.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, name, success, details=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
            if details:
                print(f"   Details: {details}")
        
        self.results.append({
            "name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_health_endpoint(self):
        """Test API health check: GET /api/health"""
        try:
            url = f"{self.base_url}/api/health"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "ok":
                    self.log_result("Health Check", True, f"Status: {data}")
                    return True
                else:
                    self.log_result("Health Check", False, f"Invalid response: {data}")
                    return False
            else:
                self.log_result("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, str(e))
            return False

    def test_dxy_terminal_api(self):
        """Test DXY terminal API: GET /api/fractal/dxy/terminal"""
        try:
            url = f"{self.base_url}/api/fractal/dxy/terminal"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Check if response has expected structure for DXY terminal
                if "core" in data or "meta" in data:
                    self.log_result("DXY Terminal API", True, f"Response keys: {list(data.keys())}")
                    return True
                else:
                    self.log_result("DXY Terminal API", False, f"Missing expected keys in response: {list(data.keys())}")
                    return False
            else:
                self.log_result("DXY Terminal API", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_result("DXY Terminal API", False, str(e))
            return False

    def test_spx_focus_pack_api(self):
        """Test SPX focus pack API: GET /api/spx/v2.1/focus-pack?focus=30d"""
        try:
            url = f"{self.base_url}/api/spx/v2.1/focus-pack?focus=30d"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Check if response has expected structure
                if "ok" in data and data["ok"] and "data" in data:
                    self.log_result("SPX Focus Pack API", True, f"Symbol: {data.get('symbol', 'N/A')}, Focus: {data.get('focus', 'N/A')}")
                    return True
                else:
                    self.log_result("SPX Focus Pack API", False, f"Invalid response structure: {list(data.keys())}")
                    return False
            else:
                self.log_result("SPX Focus Pack API", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_result("SPX Focus Pack API", False, str(e))
            return False

    def test_prediction_stats_api(self):
        """Test Prediction snapshots API: GET /api/prediction/stats"""
        try:
            url = f"{self.base_url}/api/prediction/stats"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Check if response is valid (could be empty but should be JSON)
                if isinstance(data, (dict, list)):
                    self.log_result("Prediction Stats API", True, f"Response type: {type(data).__name__}")
                    return True
                else:
                    self.log_result("Prediction Stats API", False, f"Invalid response type: {type(data)}")
                    return False
            else:
                self.log_result("Prediction Stats API", False, f"Status code: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_result("Prediction Stats API", False, str(e))
            return False

    def test_overview_api(self):
        """Test Overview API (used by frontend)"""
        try:
            url = f"{self.base_url}/api/ui/overview?asset=spx&horizon=90"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "verdict" in data or "ok" in data:
                    self.log_result("Overview API", True, f"Response structure valid")
                    return True
                else:
                    self.log_result("Overview API", False, f"Missing expected keys: {list(data.keys())}")
                    return False
            else:
                self.log_result("Overview API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Overview API", False, str(e))
            return False

    def test_api_endpoints(self):
        """Test additional API endpoints that might be available"""
        endpoints = [
            ("/api/spx/v2.1/core/terminal", "SPX Terminal API"),
            ("/api/spx/v2.1/horizons", "SPX Horizons API"),
            ("/api/fractal/dxy/macro/debug", "DXY Macro Debug API"),
        ]
        
        for endpoint, name in endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                response = requests.get(url, timeout=20)
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result(name, True, f"Status: {response.status_code}")
                else:
                    self.log_result(name, False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_result(name, False, str(e))

    def run_all_tests(self):
        """Run all backend tests"""
        print("🔥 Starting Fractal Platform Backend Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Core API tests (required)
        self.test_health_endpoint()
        self.test_dxy_terminal_api()
        self.test_spx_focus_pack_api()
        self.test_prediction_stats_api()
        self.test_overview_api()
        
        # Additional API tests
        self.test_api_endpoints()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = FractalPlatformTester()
    success = tester.run_all_tests()
    
    # Save results
    with open('/app/test_results_backend.json', 'w') as f:
        json.dump({
            "tests_run": tester.tests_run,
            "tests_passed": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run)*100,
            "results": tester.results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())