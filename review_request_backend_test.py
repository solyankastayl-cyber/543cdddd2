#!/usr/bin/env python3
"""
Specific Backend API Testing for Review Request
Tests the exact endpoints mentioned in the review request.
"""

import requests
import sys
import json
from datetime import datetime

class ReviewRequestTester:
    def __init__(self, base_url="https://forex-fractal.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.passed_tests = []

    def test_endpoint(self, name, endpoint, timeout=30):
        """Test a specific endpoint"""
        self.tests_run += 1
        url = f"{self.base_url}{endpoint}"
        
        try:
            print(f"\n🔍 Testing: {name}")
            print(f"   URL: {url}")
            
            response = requests.get(url, timeout=timeout)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"✅ {name} - PASSED")
                    
                    # Check for specific response structure
                    if 'ok' in data and data['ok']:
                        print(f"   Response: OK")
                    elif 'status' in data:
                        print(f"   Status: {data['status']}")
                    
                    # Check for specific expected fields based on endpoint
                    if 'focus-pack' in endpoint:
                        if 'data' in data or 'focusPack' in data:
                            print(f"   ✓ Has forecast/overlay data")
                        if 'overlay' in str(data) or 'forecast' in str(data):
                            print(f"   ✓ Contains overlay/forecast")
                    elif 'terminal' in endpoint:
                        if 'core' in data or 'hybrid' in data:
                            print(f"   ✓ Has core price/hybrid path")
                    elif 'candles' in endpoint:
                        if 'candles' in data and isinstance(data['candles'], list):
                            print(f"   ✓ Returns {len(data['candles'])} candles")
                    elif 'snapshots' in endpoint:
                        if 'snapshots' in data:
                            print(f"   ✓ Returns prediction snapshots")
                    
                    self.tests_passed += 1
                    self.passed_tests.append(name)
                    return True, data
                    
                except json.JSONDecodeError:
                    print(f"❌ {name} - FAILED (Invalid JSON)")
                    self.failed_tests.append(f"{name}: Invalid JSON response")
                    return False, None
            else:
                print(f"❌ {name} - FAILED (Status: {response.status_code})")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                    self.failed_tests.append(f"{name}: {response.status_code} - {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                    self.failed_tests.append(f"{name}: {response.status_code} - {response.text[:100]}")
                return False, None
                
        except requests.exceptions.Timeout:
            print(f"❌ {name} - FAILED (Timeout)")
            self.failed_tests.append(f"{name}: Request timeout")
            return False, None
        except Exception as e:
            print(f"❌ {name} - FAILED ({str(e)})")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, None

    def run_review_tests(self):
        """Run all tests from review request"""
        
        print("="*70)
        print("FRACTAL PLATFORM - REVIEW REQUEST TESTING")
        print("="*70)
        
        # 1. Backend health endpoint /api/health
        self.test_endpoint(
            "Backend Health",
            "/api/health"
        )
        
        # 2. BTC focus-pack endpoint /api/fractal/v2.1/focus-pack?focus=30d
        success, data = self.test_endpoint(
            "BTC Focus-Pack 30d", 
            "/api/fractal/v2.1/focus-pack?focus=30d"
        )
        
        # 3. SPX focus-pack endpoint /api/spx/v2.1/focus-pack?horizon=30d
        self.test_endpoint(
            "SPX Focus-Pack 30d",
            "/api/spx/v2.1/focus-pack?horizon=30d"
        )
        
        # 4. DXY terminal endpoint /api/fractal/dxy/terminal?focus=30d
        self.test_endpoint(
            "DXY Terminal 30d",
            "/api/fractal/dxy/terminal?focus=30d"
        )
        
        # 5. BTC candles endpoint /api/market/candles?asset=BTC&limit=10
        self.test_endpoint(
            "BTC Market Candles",
            "/api/market/candles?asset=BTC&limit=10"
        )
        
        # 6. SPX candles endpoint /api/market/candles?asset=SPX&limit=10
        self.test_endpoint(
            "SPX Market Candles", 
            "/api/market/candles?asset=SPX&limit=10"
        )
        
        # 7. DXY candles endpoint /api/market/candles?asset=DXY&limit=10
        self.test_endpoint(
            "DXY Market Candles",
            "/api/market/candles?asset=DXY&limit=10"  
        )
        
        # 8. BTC prediction snapshots /api/prediction/snapshots?asset=BTC&view=hybrid&horizon=30&limit=1
        self.test_endpoint(
            "BTC Prediction Snapshots",
            "/api/prediction/snapshots?asset=BTC&view=hybrid&horizon=30&limit=1"
        )
        
        # Additional horizon testing for BTC as mentioned in review
        print(f"\n📊 Testing additional horizons...")
        
        for horizon in ["7d", "14d", "90d"]:
            self.test_endpoint(
                f"BTC Focus-Pack {horizon}",
                f"/api/fractal/v2.1/focus-pack?focus={horizon}"
            )
        
        for horizon in ["7d", "14d", "90d"]:
            self.test_endpoint(
                f"SPX Focus-Pack {horizon}",
                f"/api/spx/v2.1/focus-pack?horizon={horizon}"
            )

    def print_summary(self):
        """Print final test summary"""
        print("\n" + "="*70)
        print("📊 FINAL TEST SUMMARY")
        print("="*70)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Total Tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")  
        print(f"❌ Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test}")
        
        if self.passed_tests:
            print(f"\n✅ PASSED TESTS:")
            for i, test in enumerate(self.passed_tests, 1):
                print(f"   {i}. {test}")
        
        # Determine overall success
        critical_endpoints_passed = 0
        critical_endpoints = [
            "Backend Health",
            "BTC Focus-Pack 30d", 
            "SPX Focus-Pack 30d",
            "DXY Terminal 30d"
        ]
        
        for endpoint in critical_endpoints:
            if endpoint in self.passed_tests:
                critical_endpoints_passed += 1
        
        print(f"\nCritical Endpoints: {critical_endpoints_passed}/{len(critical_endpoints)} passed")
        
        return success_rate >= 70 and critical_endpoints_passed >= 3

def main():
    """Main test execution"""
    tester = ReviewRequestTester()
    
    try:
        tester.run_review_tests()
        success = tester.print_summary()
        
        # Save results
        results = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "failed_tests": len(tester.failed_tests),
            "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
            "passed_list": tester.passed_tests,
            "failed_list": tester.failed_tests,
            "overall_success": success
        }
        
        with open('/app/review_request_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
            
        print(f"\nDetailed results saved to: /app/review_request_test_results.json")
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())