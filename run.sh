#!/bin/bash
# Eugene Data Labs - Local Runner
# 
# Quick start script for running Eugene on your machine.
#
# Prerequisites:
#   - Python 3.10+
#   - ANTHROPIC_API_KEY environment variable
#
# Usage:
#   ./run.sh setup      # First time setup
#   ./run.sh extract    # Run extraction on TSLA
#   ./run.sh batch      # Run batch on multiple companies
#   ./run.sh api        # Start API server
#   ./run.sh web        # Start web UI
#   ./run.sh test       # Run tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python
check_python() {
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Python found: $(python3 --version)${NC}"
}

# Check API key
check_api_key() {
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo -e "${YELLOW}Warning: ANTHROPIC_API_KEY not set${NC}"
        echo "Set it with: export ANTHROPIC_API_KEY=your-key"
        return 1
    fi
    echo -e "${GREEN}✓ API key set${NC}"
    return 0
}

# Setup
cmd_setup() {
    echo "Setting up Eugene Data Labs..."
    echo
    
    check_python
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing dependencies..."
    pip install -r requirements.txt --quiet
    
    # Check API key
    check_api_key || true
    
    echo
    echo -e "${GREEN}✓ Setup complete!${NC}"
    echo
    echo "Next steps:"
    echo "  1. Set your API key: export ANTHROPIC_API_KEY=your-key"
    echo "  2. Test extraction: ./run.sh extract TSLA"
}

# Extract
cmd_extract() {
    source venv/bin/activate
    check_api_key || exit 1
    
    TICKER=${1:-TSLA}
    echo "Extracting credit data for $TICKER..."
    python eugene_cli.py extract --ticker "$TICKER"
}

# Batch
cmd_batch() {
    source venv/bin/activate
    check_api_key || exit 1
    
    TICKERS=${@:-"TSLA AAPL MSFT"}
    echo "Running batch extraction for: $TICKERS"
    python eugene_cli.py batch --tickers $TICKERS
}

# API
cmd_api() {
    source venv/bin/activate
    echo "Starting API server on http://localhost:8000"
    python eugene_cli.py api --port 8000
}

# Web UI
cmd_web() {
    echo "Starting web UI..."
    echo "Open http://localhost:8080 in your browser"
    python3 -m http.server 8080 --directory web
}

# Test
cmd_test() {
    source venv/bin/activate
    echo "Running tests..."
    python test_offline.py
}

# Mock test
cmd_mock() {
    source venv/bin/activate
    echo "Running mock API test..."
    python test_mock_api.py
}

# Health check
cmd_health() {
    source venv/bin/activate
    echo "Running health check..."
    python eugene_cli.py health --metrics
}

# Help
cmd_help() {
    echo "Eugene Data Labs - Local Runner"
    echo
    echo "Usage: ./run.sh <command> [args]"
    echo
    echo "Commands:"
    echo "  setup              First time setup"
    echo "  extract [TICKER]   Extract credit data (default: TSLA)"
    echo "  batch [TICKERS]    Batch extract multiple companies"
    echo "  api                Start API server"
    echo "  web                Start web UI"
    echo "  test               Run offline tests"
    echo "  mock               Run mock API test"
    echo "  health             Run health check"
    echo
    echo "Examples:"
    echo "  ./run.sh setup"
    echo "  ./run.sh extract AAPL"
    echo "  ./run.sh batch TSLA AAPL MSFT GOOGL AMZN"
    echo "  ./run.sh api"
}

# Main
case "${1:-help}" in
    setup)
        cmd_setup
        ;;
    extract)
        cmd_extract "${@:2}"
        ;;
    batch)
        cmd_batch "${@:2}"
        ;;
    api)
        cmd_api
        ;;
    web)
        cmd_web
        ;;
    test)
        cmd_test
        ;;
    mock)
        cmd_mock
        ;;
    health)
        cmd_health
        ;;
    *)
        cmd_help
        ;;
esac
