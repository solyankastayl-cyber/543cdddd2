#!/usr/bin/env python3
"""
Additional Comprehensive Tests for Unified Snapshot Logic
Test edge cases and verify the unified implementation works across all assets.
"""

import requests
import sys
import json
from datetime import datetime

class ComprehensiveSnapshotTester:
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

    def test_all_horizon_variations(self):
        """Test all horizon variations for unified extractors"""
        horizons = ['7d', '14d', '30d', '90d']
        
        for horizon in horizons:
            self.test_btc_horizon(horizon)
            self.test_spx_horizon(horizon)
            self.test_dxy_horizon(horizon)

    def test_btc_horizon(self, horizon):
        """Test BTC focus-pack for specific horizon"""
        try:
            url = f"{self.base_url}/api/fractal/v2.1/focus-pack?focus={horizon}"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('ok') and 'focusPack' in data:
                    focus_pack = data['focusPack']
                    has_forecast = 'forecast' in focus_pack and len(focus_pack['forecast'].get('path', [])) > 0
                    has_overlay = 'overlay' in focus_pack and len(focus_pack['overlay'].get('currentWindow', {}).get('raw', [])) > 0
                    
                    success = has_forecast and has_overlay
                    forecast_len = len(focus_pack['forecast'].get('path', []))
                    details = f"Forecast: {forecast_len} points"
                    
                    self.log_result(f"BTC {horizon} horizon", success, details)
                    return success
                else:
                    self.log_result(f"BTC {horizon} horizon", False, "Invalid response structure")
                    return False
            else:
                self.log_result(f"BTC {horizon} horizon", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result(f"BTC {horizon} horizon", False, str(e))
            return False

    def test_spx_horizon(self, horizon):
        """Test SPX focus-pack for specific horizon"""
        try:
            url = f"{self.base_url}/api/spx/v2.1/focus-pack?horizon={horizon}"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('ok') and 'data' in data:
                    spx_data = data['data']
                    has_forecast = 'forecast' in spx_data and len(spx_data['forecast'].get('path', [])) > 0
                    has_overlay = 'overlay' in spx_data
                    
                    success = has_forecast and has_overlay
                    forecast_len = len(spx_data['forecast'].get('path', []))
                    details = f"Forecast: {forecast_len} points"
                    
                    self.log_result(f"SPX {horizon} horizon", success, details)
                    return success
                else:
                    self.log_result(f"SPX {horizon} horizon", False, "Invalid response structure")
                    return False
            else:
                self.log_result(f"SPX {horizon} horizon", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result(f"SPX {horizon} horizon", False, str(e))
            return False

    def test_dxy_horizon(self, horizon):
        """Test DXY terminal for specific horizon"""
        try:
            url = f"{self.base_url}/api/fractal/dxy/terminal?focus={horizon}"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                has_hybrid = 'hybrid' in data and len(data['hybrid'].get('path', [])) > 0
                has_replay = 'replay' in data and len(data['replay'].get('window', [])) > 0
                has_core = 'core' in data
                
                success = has_hybrid and has_replay and has_core
                hybrid_len = len(data.get('hybrid', {}).get('path', []))
                details = f"Hybrid: {hybrid_len} points"
                
                self.log_result(f"DXY {horizon} horizon", success, details)
                return success
            else:
                self.log_result(f"DXY {horizon} horizon", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result(f"DXY {horizon} horizon", False, str(e))
            return False

    def test_prediction_snapshots_unified_features(self):
        """Test that all prediction snapshots have unified features"""
        assets = ['BTC', 'SPX', 'DXY']
        views = ['hybrid', 'crossAsset']
        
        for asset in assets:
            for view in views:
                self.test_snapshot_unified_features(asset, view)

    def test_snapshot_unified_features(self, asset, view):
        """Test specific asset/view snapshot for unified features"""
        try:
            url = f"{self.base_url}/api/prediction/snapshots?asset={asset}&view={view}&horizon=90&limit=1"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                snapshots = []
                if isinstance(data, list):
                    snapshots = data
                elif isinstance(data, dict) and 'snapshots' in data:
                    snapshots = data['snapshots']
                
                if len(snapshots) > 0:
                    snapshot = snapshots[0]
                    
                    # Check unified features
                    has_anchor_index = 'anchorIndex' in snapshot
                    has_series = 'series' in snapshot and len(snapshot['series']) > 0
                    has_asset = snapshot.get('asset') == asset
                    has_view = snapshot.get('view') == view
                    
                    # Check if anchorIndex is valid
                    valid_anchor = False
                    if has_anchor_index and has_series:
                        anchor_idx = snapshot['anchorIndex']
                        series_len = len(snapshot['series'])
                        valid_anchor = isinstance(anchor_idx, int) and 0 <= anchor_idx < series_len
                    
                    success = has_anchor_index and has_series and has_asset and has_view and valid_anchor
                    
                    details = f"AnchorIndex: {snapshot.get('anchorIndex', 'Missing')}, Series: {len(snapshot.get('series', []))}"
                    
                    self.log_result(f"{asset} {view} snapshot unified features", success, details)
                    return success
                else:
                    # No snapshots found - could be valid if none exist yet
                    self.log_result(f"{asset} {view} snapshot unified features", True, "No snapshots found (acceptable)")
                    return True
            else:
                self.log_result(f"{asset} {view} snapshot unified features", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result(f"{asset} {view} snapshot unified features", False, str(e))
            return False

    def test_series_temporal_consistency(self):
        """Test that series timestamps are properly ordered"""
        try:
            url = f"{self.base_url}/api/prediction/snapshots?asset=BTC&view=hybrid&horizon=30&limit=1"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                snapshots = []
                if isinstance(data, list):
                    snapshots = data
                elif isinstance(data, dict) and 'snapshots' in data:
                    snapshots = data['snapshots']
                
                if len(snapshots) > 0:
                    snapshot = snapshots[0]
                    
                    if 'series' in snapshot and 'anchorIndex' in snapshot:
                        series = snapshot['series']
                        anchor_index = snapshot['anchorIndex']
                        
                        # Check temporal ordering
                        timestamps = [point['t'] for point in series]
                        is_ordered = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                        
                        # Check anchor point exists
                        anchor_valid = 0 <= anchor_index < len(series)
                        
                        # Check history is before anchor, forecast is after
                        temporal_consistency = True
                        if anchor_valid and len(series) > 1:
                            anchor_date = series[anchor_index]['t']
                            
                            # History should be before anchor
                            for i in range(anchor_index):
                                if series[i]['t'] >= anchor_date:
                                    temporal_consistency = False
                                    break
                            
                            # Forecast should be after anchor  
                            for i in range(anchor_index + 1, len(series)):
                                if series[i]['t'] <= anchor_date:
                                    temporal_consistency = False
                                    break
                        
                        success = is_ordered and anchor_valid and temporal_consistency
                        details = f"Ordered: {is_ordered}, AnchorValid: {anchor_valid}, Temporal: {temporal_consistency}"
                        
                        self.log_result("Series temporal consistency", success, details)
                        return success
                    else:
                        self.log_result("Series temporal consistency", False, "Missing series or anchorIndex")
                        return False
                else:
                    self.log_result("Series temporal consistency", True, "No snapshots to test (acceptable)")
                    return True
            else:
                self.log_result("Series temporal consistency", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Series temporal consistency", False, str(e))
            return False

    def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🔥 Starting Comprehensive Unified Snapshot Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        # Test all horizon variations
        print("\n📈 Testing All Horizon Variations:")
        self.test_all_horizon_variations()
        
        # Test prediction snapshots unified features
        print("\n📸 Testing Prediction Snapshots Unified Features:")
        self.test_prediction_snapshots_unified_features()
        
        # Test series temporal consistency
        print("\n⏰ Testing Series Temporal Consistency:")
        self.test_series_temporal_consistency()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 COMPREHENSIVE TEST SUMMARY")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = ComprehensiveSnapshotTester()
    success = tester.run_all_tests()
    
    # Save results
    with open('/app/comprehensive_snapshot_test_results.json', 'w') as f:
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