#!/usr/bin/env python3
"""Wrapper to catch any startup errors and log to stderr."""
import sys
import os

sys.stderr.write("Eugene wrapper: Starting\n")
sys.stderr.flush()

try:
    # Set up paths
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Load env
    from dotenv import load_dotenv
    env_path = os.environ.get("DOTENV_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
    load_dotenv(env_path)
    sys.stderr.write("Eugene wrapper: Env loaded\n")
    sys.stderr.flush()
    
    # Import server
    from mcp.server import MCPServer
    sys.stderr.write("Eugene wrapper: Server imported\n")
    sys.stderr.flush()
    
    # Run
    server = MCPServer()
    sys.stderr.write("Eugene wrapper: Running stdio\n")
    sys.stderr.flush()
    server.run_stdio()
    
except Exception as e:
    import traceback
    sys.stderr.write("Eugene wrapper FATAL: {}\n".format(e))
    sys.stderr.write(traceback.format_exc())
    sys.stderr.flush()
    sys.exit(1)
