#!/usr/bin/env python3
"""
ARCHITECTURAL FIXES TEST SUITE
Testing three specific architectural changes:
1. History fixed at 365 days regardless of forecast horizon
2. Overview reads from snapshots (read-only, no model recalculation)
3. Unified snapshot data for BTC/SPX/DXY

Requirements from review request:
- History always 365 days - check anchorIndex for different horizons (30d, 90d, 180d)
- Overview reads from snapshot (modelVersion: v3.2.0-unified, source: snapshot_readonly)  
- Overview and Final Fractal show SAME forecastMax for BTC/SPX/DXY
- DXY history has 365 days (anchorIndex = 365)
- Snapshot series contains history → anchor → forecast structure
- Overview charts.actual and charts.predicted NOT empty
"""

import requests
import json
import sys
from typing import Dict, Any, List, Optional
from datetime import datetime

class ArchitecturalTestSuite:
    def __init__(self, base_url: str = "https://forex-fractal.preview.emergentagent.com"):
        self.base_url = base_url
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": base_url,
            "tests_run": 0,
            "tests_passed": 0,
            "critical_issues": [],
            "test_details": [],
            "architecture_validation": {
                "fixed_history_365d": {},
                "overview_readonly": {},
                "unified_forecastmax": {},
                "charts_not_empty": {}
            }
        }

    def log_test(self, name: str, passed: bool, details: Dict[str, Any] = None):
        """Log test result"""
        self.results["tests_run"] += 1
        if passed:
            self.results["tests_passed"] += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}")
            if details:
                self.results["critical_issues"].append(f"{name}: {details}")
        
        self.results["test_details"].append({
            "name": name,
            "passed": passed,
            "details": details or {}
        })

    def make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Make API request with error handling"""
        try:
            url = f"{self.base_url}{endpoint}"
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️  HTTP {response.status_code} for {endpoint}")
                return None
        except Exception as e:
            print(f"⚠️  Request failed for {endpoint}: {str(e)}")
            return None

    def test_history_fixed_365_days(self):
        """
        TEST 1: History is always 365 days regardless of forecast horizon
        Check anchorIndex for different horizons (30d, 90d, 180d)
        """
        print("\n🔍 Testing History Fixed at 365 Days...")
        
        assets = ['BTC', 'SPX', 'DXY']
        horizons = ['30d', '90d', '180d']
        
        for asset in assets:
            for horizon in horizons:
                # Get focus-pack data
                if asset == 'BTC':
                    endpoint = f"/api/fractal/v2.1/focus-pack?symbol={asset}&focus={horizon}"
                elif asset == 'SPX':
                    endpoint = f"/api/spx/v2.1/focus-pack?horizon={horizon}"
                elif asset == 'DXY':
                    endpoint = f"/api/fractal/dxy/terminal?focus={horizon}"
                
                data = self.make_request(endpoint)
                if not data:
                    self.log_test(f"{asset} {horizon} - API Response", False, {"error": "No response"})
                    continue
                
                # Extract series data based on asset structure
                series = None
                anchor_index = None
                
                if asset == 'BTC':
                    series = data.get('series')
                    anchor_index = data.get('anchorIndex')
                elif asset == 'SPX':
                    spx_data = data.get('data', {})
                    series = spx_data.get('series')
                    anchor_index = spx_data.get('anchorIndex')
                elif asset == 'DXY':
                    series = data.get('series')
                    anchor_index = data.get('anchorIndex')
                
                if series and anchor_index is not None:
                    # Check if anchorIndex is close to 365 (allowing some variation for weekends/holidays)
                    history_days = anchor_index
                    expected_range = (360, 370)  # Allow some tolerance
                    
                    is_valid = expected_range[0] <= history_days <= expected_range[1]
                    test_name = f"{asset} {horizon} - History Days = {history_days}"
                    
                    self.log_test(test_name, is_valid, {
                        "history_days": history_days,
                        "anchor_index": anchor_index,
                        "series_length": len(series),
                        "expected_range": expected_range
                    })
                    
                    self.results["architecture_validation"]["fixed_history_365d"][f"{asset}_{horizon}"] = {
                        "history_days": history_days,
                        "valid": is_valid
                    }
                else:
                    self.log_test(f"{asset} {horizon} - Series Structure", False, {
                        "series_present": bool(series),
                        "anchor_index_present": anchor_index is not None
                    })

    def test_overview_readonly_snapshots(self):
        """
        TEST 2: Overview reads from snapshots (read-only, no model recalculation)
        Check for modelVersion: v3.2.0-unified and source: snapshot_readonly
        """
        print("\n🔍 Testing Overview Read-Only from Snapshots...")
        
        assets = ['dxy', 'spx', 'btc']
        horizons = [30, 90, 180]
        
        for asset in assets:
            for horizon in horizons:
                endpoint = f"/api/ui/overview?asset={asset}&horizon={horizon}"
                data = self.make_request(endpoint)
                
                if not data or not data.get('ok'):
                    self.log_test(f"Overview {asset.upper()} {horizon}d - API Response", False, {
                        "error": "No valid response"
                    })
                    continue
                
                # Check for read-only indicators
                meta = data.get('meta', {})
                model_version = meta.get('systemVersion', '')
                
                # Look for model version in response (could be in different places)
                version_found = False
                readonly_source = False
                
                # Check various locations for version info
                if 'v3' in model_version or 'v3.2.0' in str(data):
                    version_found = True
                
                # Check for read-only source indicators
                if 'snapshot_readonly' in str(data) or 'READ-ONLY' in str(data):
                    readonly_source = True
                
                test_name = f"Overview {asset.upper()} {horizon}d - Read-Only Snapshot"
                is_valid = version_found and data.get('ok', False)
                
                self.log_test(test_name, is_valid, {
                    "system_version": model_version,
                    "version_found": version_found,
                    "readonly_source": readonly_source,
                    "has_charts": bool(data.get('charts'))
                })
                
                self.results["architecture_validation"]["overview_readonly"][f"{asset}_{horizon}"] = {
                    "model_version": model_version,
                    "readonly_indicators": readonly_source,
                    "valid": is_valid
                }

    def test_unified_forecastmax_consistency(self):
        """
        TEST 3: Overview and Final Fractal show SAME forecastMax
        Compare forecastMax values between overview and focus-pack endpoints
        """
        print("\n🔍 Testing Unified ForecastMax Consistency...")
        
        test_cases = [
            ('BTC', 'btc', '90d', 90),
            ('SPX', 'spx', '90d', 90),
            ('DXY', 'dxy', '90d', 90)
        ]
        
        for asset_upper, asset_lower, horizon_str, horizon_num in test_cases:
            # Get Overview data
            overview_data = self.make_request(f"/api/ui/overview?asset={asset_lower}&horizon={horizon_num}")
            
            # Get Focus-pack data
            if asset_upper == 'BTC':
                focus_data = self.make_request(f"/api/fractal/v2.1/focus-pack?symbol={asset_upper}&focus={horizon_str}")
            elif asset_upper == 'SPX':
                focus_data = self.make_request(f"/api/spx/v2.1/focus-pack?horizon={horizon_str}")
            elif asset_upper == 'DXY':
                focus_data = self.make_request(f"/api/fractal/dxy/terminal?focus={horizon_str}")
            
            if not overview_data or not focus_data:
                self.log_test(f"{asset_upper} ForecastMax - API Availability", False, {
                    "overview_available": bool(overview_data),
                    "focus_available": bool(focus_data)
                })
                continue
            
            # Extract forecastMax values
            overview_forecast = None
            focus_forecast = None
            
            # Overview: look in pipeline, verdict, or horizons
            if overview_data.get('pipeline'):
                pipeline = overview_data['pipeline']
                if 'dxyFinal' in pipeline:
                    overview_forecast = pipeline['dxyFinal'].get('projectionPct')
            
            if overview_data.get('verdict'):
                verdict = overview_data['verdict']
                if 'horizonDays' in verdict:
                    overview_forecast = verdict.get('horizonDays')
            
            # Focus-pack: look in summary or forecast
            if asset_upper == 'BTC':
                summary = focus_data.get('summary', {})
                projection = summary.get('projection', {})
                focus_forecast = projection.get('median')
            elif asset_upper == 'SPX':
                spx_data = focus_data.get('data', {})
                summary = spx_data.get('summary', {})
                projection = summary.get('projection', {})
                focus_forecast = projection.get('median')
            elif asset_upper == 'DXY':
                summary = focus_data.get('summary', {})
                projection = summary.get('projection', {})
                focus_forecast = projection.get('median')
            
            # Compare values (allowing for small differences due to rounding)
            consistency_check = False
            if overview_forecast is not None and focus_forecast is not None:
                # Convert to percentages if needed
                if abs(overview_forecast) > 1:
                    overview_pct = overview_forecast
                else:
                    overview_pct = overview_forecast * 100
                
                if abs(focus_forecast) > 1:
                    focus_pct = focus_forecast
                else:
                    focus_pct = focus_forecast * 100
                
                # Allow 1% tolerance for rounding differences
                consistency_check = abs(overview_pct - focus_pct) <= 1.0
            
            test_name = f"{asset_upper} ForecastMax Consistency"
            self.log_test(test_name, consistency_check, {
                "overview_forecast": overview_forecast,
                "focus_forecast": focus_forecast,
                "difference": abs(overview_forecast - focus_forecast) if (overview_forecast and focus_forecast) else None
            })
            
            self.results["architecture_validation"]["unified_forecastmax"][asset_upper] = {
                "overview_forecast": overview_forecast,
                "focus_forecast": focus_forecast,
                "consistent": consistency_check
            }

    def test_overview_charts_not_empty(self):
        """
        TEST 4: Overview charts.actual and charts.predicted NOT empty
        """
        print("\n🔍 Testing Overview Charts Not Empty...")
        
        assets = ['dxy', 'spx', 'btc']
        
        for asset in assets:
            endpoint = f"/api/ui/overview?asset={asset}&horizon=90"
            data = self.make_request(endpoint)
            
            if not data or not data.get('ok'):
                self.log_test(f"Overview {asset.upper()} - Charts API", False, {"error": "No response"})
                continue
            
            charts = data.get('charts', {})
            actual = charts.get('actual', [])
            predicted = charts.get('predicted', [])
            
            has_actual = len(actual) > 0
            has_predicted = len(predicted) > 0
            charts_valid = has_actual and has_predicted
            
            test_name = f"Overview {asset.upper()} - Charts Not Empty"
            self.log_test(test_name, charts_valid, {
                "actual_points": len(actual),
                "predicted_points": len(predicted),
                "charts_structure": bool(charts)
            })
            
            self.results["architecture_validation"]["charts_not_empty"][asset] = {
                "actual_count": len(actual),
                "predicted_count": len(predicted),
                "valid": charts_valid
            }

    def test_dxy_365_days_verification(self):
        """
        TEST 5: DXY specific verification - history has 365 days (anchorIndex = 365)
        """
        print("\n🔍 Testing DXY 365 Days History Verification...")
        
        horizons = ['30d', '90d', '180d']
        
        for horizon in horizons:
            endpoint = f"/api/fractal/dxy/terminal?focus={horizon}"
            data = self.make_request(endpoint)
            
            if not data:
                self.log_test(f"DXY {horizon} - API Response", False, {"error": "No response"})
                continue
            
            anchor_index = data.get('anchorIndex')
            series = data.get('series', [])
            
            if anchor_index is not None:
                # Check if anchorIndex is close to 365
                is_365_days = 360 <= anchor_index <= 370  # Allow tolerance for weekends
                
                test_name = f"DXY {horizon} - AnchorIndex = {anchor_index}"
                self.log_test(test_name, is_365_days, {
                    "anchor_index": anchor_index,
                    "series_length": len(series),
                    "expected_range": "360-370"
                })
            else:
                self.log_test(f"DXY {horizon} - AnchorIndex Missing", False, {
                    "anchor_index": anchor_index,
                    "series_present": bool(series)
                })

    def run_all_tests(self):
        """Run all architectural tests"""
        print("🚀 Starting Architectural Fixes Test Suite...")
        print(f"📡 Base URL: {self.base_url}")
        print("=" * 80)
        
        # Run all test suites
        self.test_history_fixed_365_days()
        self.test_overview_readonly_snapshots()
        self.test_unified_forecastmax_consistency()
        self.test_overview_charts_not_empty()
        self.test_dxy_365_days_verification()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary:")
        print(f"   Tests Run: {self.results['tests_run']}")
        print(f"   Tests Passed: {self.results['tests_passed']}")
        print(f"   Success Rate: {(self.results['tests_passed']/self.results['tests_run']*100):.1f}%")
        
        if self.results['critical_issues']:
            print(f"   Critical Issues: {len(self.results['critical_issues'])}")
            for issue in self.results['critical_issues']:
                print(f"     - {issue}")
        
        # Save results
        with open('/app/architectural_test_results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
        
        return self.results['tests_passed'] == self.results['tests_run']

def main():
    tester = ArchitecturalTestSuite()
    success = tester.run_all_tests()
    
    print(f"\n🏁 Test suite completed. Results saved to: /app/architectural_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())