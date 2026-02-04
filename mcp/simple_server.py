#!/usr/bin/env python3
import sys
import json

sys.stderr.write("Simple server starting\n")
sys.stderr.flush()

for line in sys.stdin:
    sys.stderr.write("Got: " + line[:50] + "\n")
    sys.stderr.flush()
    try:
        req = json.loads(line)
        if req.get("method") == "initialize":
            resp = {"jsonrpc": "2.0", "id": req["id"], "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "test", "version": "0.1"}
            }}
        elif req.get("method") == "tools/list":
            resp = {"jsonrpc": "2.0", "id": req["id"], "result": {"tools": []}}
        elif req.get("method") == "notifications/initialized":
            continue
        else:
            resp = {"jsonrpc": "2.0", "id": req.get("id"), "error": {"code": -32601, "message": "Unknown"}}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write("Error: " + str(e) + "\n")
        sys.stderr.flush()
