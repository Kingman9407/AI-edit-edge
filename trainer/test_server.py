import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.error

# Server Config
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000
BASE_URL = f"http://{SERVER_HOST}:{SERVER_PORT}"

def print_banner(text):
    print("=" * 70)
    print(f" {text}")
    print("=" * 70)

def make_request(path, data=None, method="GET"):
    """Helper to perform native HTTP request using standard library urllib."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    
    if data is not None:
        json_data = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
        req.data = json_data
        
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8")), response.status
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
            return json.loads(err_body), e.code
        except Exception:
            return {"error": e.reason}, e.code
    except urllib.error.URLError as e:
        return {"error": str(e.reason)}, 500

def run_tests():
    print_banner("🧪 API VERIFICATION & AUTOMATED INTEGRATION TESTER")
    
    # 1. Start the FastAPI server as a background subprocess
    print("⚡ Spawning FastAPI Server in background (uvicorn)...")
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app", "--host", SERVER_HOST, "--port", str(SERVER_PORT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    time.sleep(2.5)  # Wait for server to initialize tokenizer and model
    
    try:
        # 2. Test /health
        print("\n🔍 Step 1: Querying `/health` endpoint...")
        health, status = make_request("/health")
        if status != 200:
            print(f"❌ Failed health check. Status code: {status}. Response: {health}")
            return False
            
        print("✅ Health check succeeded!")
        print(f"   ├─ Server Status: {health.get('status')}")
        print(f"   ├─ Model Status:  {health.get('model_status')}")
        print(f"   └─ Hardware Accel: {health.get('hardware_accelerator', '').upper()}")
        
        # 3. Test /api/edit with a test timeline command
        print("\n🔍 Step 2: Sending POST request to `/api/edit`...")
        test_payload = {
            "user_message": "cut the middle 30 seconds of the video",
            "workspace_state": {
                "duration": 480.0,
                "playhead": 120.0,
                "silent_sections": [
                    {"start": 10.0, "end": 15.0},
                    {"start": 150.0, "end": 195.0}
                ],
                "existing_cuts": [],
                "background_music": []
            },
            "video_metadata": {
                "name": "tutorial_recording.mp4",
                "type": "video/mp4",
                "resolution": "1920x1080"
            }
        }
        
        start_time = time.perf_counter()
        response, status = make_request("/api/edit", data=test_payload, method="POST")
        duration = time.perf_counter() - start_time
        
        if status != 200:
            print(f"❌ POST `/api/edit` failed! Code: {status}. Error: {response}")
            return False
            
        print("✅ Edit request processed successfully!")
        print(f"   ├─ Request Message:   \"{test_payload['user_message']}\"")
        print(f"   ├─ Latency (Client):   {duration:.3f}s")
        print(f"   ├─ Latency (API):      {response['metrics']['latency_seconds']}s")
        print(f"   ├─ Execution Mode:     {response['metrics']['model_mode'].upper()}")
        print(f"   ├─ Raw Model Output:   {response['raw_model_output']}")
        print(f"   ├─ Detected Intents:   {json.dumps(response['parsed_intents'])}")
        print(f"   └─ Resolved Actions:   {json.dumps(response['resolved_operations'])}")
        
        if "warning" in response and response["warning"]:
            print(f"   ⚠️ Warning Info: {response['warning']}")

        # 4. Verify transaction was logged
        print("\n🔍 Step 3: Fetching transaction logs from `/api/logs`...")
        # Give background thread a tiny moment to write the log entry
        time.sleep(0.5)
        logs, status = make_request("/api/logs?limit=5")
        
        if status != 200:
            print(f"❌ GET `/api/logs` failed! Code: {status}")
            return False
            
        if not logs:
            print("❌ Logging check failed. Transaction log is empty!")
            return False
            
        latest_log = logs[0]
        print("✅ Persistent JSON lines log verification passed!")
        print(f"   ├─ Total Log Entries Found: {len(logs)}")
        print(f"   ├─ Logged Timestamp:        {latest_log.get('timestamp')}")
        print(f"   ├─ Logged Latency:          {latest_log.get('latency_seconds')}s")
        print(f"   └─ Logged Request Msg:      \"{latest_log.get('request', {}).get('user_message')}\"")
        
        print_banner("🎉 ALL TESTS PASSED SUCCESSFULLY! SERVER API IS 100% READY FOR NEXT.JS")
        return True

    finally:
        # 5. Shutdown the background server cleanly
        print("\n🛑 Shutting down background FastAPI server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
            print("✅ Server process terminated gracefully.")
        except subprocess.TimeoutExpired:
            print("⚠️ Server did not exit in time. Force killing...")
            server_process.kill()
            server_process.wait()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
