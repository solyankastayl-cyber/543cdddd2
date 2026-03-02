#!/usr/bin/env python3
"""
Debug Unified Snapshot Issues
Investigate the specific response structures for failing tests.
"""

import requests
import json

base_url = "https://forex-fractal.preview.emergentagent.com"

def debug_spx_90d():
    """Debug SPX 90d response structure"""
    print("🔍 Debugging SPX 90d series length...")
    url = f"{base_url}/api/spx/v2.1/focus-pack?horizon=90d"
    response = requests.get(url, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('ok') and 'data' in data:
            spx_data = data['data']
            
            print(f"Response keys: {list(spx_data.keys())}")
            
            if 'forecast' in spx_data:
                forecast = spx_data['forecast']
                print(f"Forecast keys: {list(forecast.keys())}")
                print(f"Forecast path length: {len(forecast.get('path', []))}")
                
            if 'overlay' in spx_data:
                overlay = spx_data['overlay']
                print(f"Overlay keys: {list(overlay.keys())}")
                if 'currentWindow' in overlay:
                    window = overlay['currentWindow']
                    print(f"CurrentWindow keys: {list(window.keys())}")
                    print(f"CurrentWindow raw length: {len(window.get('raw', []))}")
                    
        print(json.dumps(data, indent=2)[:1000] + "...")
    else:
        print(f"Error: {response.status_code}")

def debug_dxy_90d():
    """Debug DXY 90d response structure"""
    print("\n🔍 Debugging DXY 90d series length...")
    url = f"{base_url}/api/fractal/dxy/terminal?focus=90d"
    response = requests.get(url, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Response keys: {list(data.keys())}")
        
        if 'hybrid' in data:
            hybrid = data['hybrid']
            print(f"Hybrid keys: {list(hybrid.keys())}")
            print(f"Hybrid path length: {len(hybrid.get('path', []))}")
            
        if 'replay' in data:
            replay = data['replay']
            print(f"Replay keys: {list(replay.keys())}")
            print(f"Replay window length: {len(replay.get('window', []))}")
            
        print(json.dumps(data, indent=2)[:1000] + "...")
    else:
        print(f"Error: {response.status_code}")

def debug_spx_snapshots():
    """Debug SPX prediction snapshots modelVersion"""
    print("\n🔍 Debugging SPX prediction snapshots modelVersion...")
    url = f"{base_url}/api/prediction/snapshots?asset=SPX&view=crossAsset&horizon=90&limit=1"
    response = requests.get(url, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Response type: {type(data)}")
        if isinstance(data, list) and len(data) > 0:
            snapshot = data[0]
            print(f"Snapshot keys: {list(snapshot.keys())}")
            print(f"ModelVersion: {snapshot.get('modelVersion')}")
            print(f"Asset: {snapshot.get('asset')}")
            print(f"View: {snapshot.get('view')}")
            
        print(json.dumps(data, indent=2)[:1000] + "...")
    else:
        print(f"Error: {response.status_code}")

if __name__ == "__main__":
    debug_spx_90d()
    debug_dxy_90d() 
    debug_spx_snapshots()