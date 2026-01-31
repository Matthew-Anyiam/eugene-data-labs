"""
Eugene Data Labs - Session State Manager

Saves conversation/session state so you can resume after:
- Claude crashes
- Context window fills up
- Conversation times out
- You close the browser

Usage:
    # Save current state
    python session_state.py save --note "Working on batch extraction"
    
    # View state
    python session_state.py show
    
    # Get resume prompt
    python session_state.py resume
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import argparse


class SessionState:
    """Manages session state for conversation continuity"""
    
    def __init__(self, state_dir: str = "data/sessions"):
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.current_file = self.state_dir / "current_session.json"
    
    def save(
        self,
        current_task: str,
        completed_tasks: List[str],
        next_steps: List[str],
        notes: str = "",
        context: Dict = None
    ):
        """Save current session state"""
        state = {
            "saved_at": datetime.now().isoformat(),
            "current_task": current_task,
            "completed_tasks": completed_tasks,
            "next_steps": next_steps,
            "notes": notes,
            "context": context or {},
            "files_modified": self._get_recent_files(),
            "environment": {
                "has_api_key": bool(os.environ.get("ANTHROPIC_API_KEY")),
                "cwd": str(Path.cwd())
            }
        }
        
        # Save current
        with open(self.current_file, 'w') as f:
            json.dump(state, f, indent=2)
        
        # Also save timestamped backup
        backup_file = self.state_dir / f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_file, 'w') as f:
            json.dump(state, f, indent=2)
        
        print(f"✓ Session saved: {self.current_file}")
        return state
    
    def load(self) -> Optional[Dict]:
        """Load current session state"""
        if not self.current_file.exists():
            return None
        
        with open(self.current_file) as f:
            return json.load(f)
    
    def _get_recent_files(self, hours: int = 24) -> List[str]:
        """Get files modified in last N hours"""
        recent = []
        cutoff = datetime.now().timestamp() - (hours * 3600)
        
        eugene_dir = Path(__file__).parent
        
        for path in eugene_dir.rglob("*.py"):
            if path.stat().st_mtime > cutoff:
                recent.append(str(path.relative_to(eugene_dir)))
        
        return recent[:20]  # Limit to 20
    
    def generate_resume_prompt(self) -> str:
        """Generate a prompt to resume conversation with Claude"""
        state = self.load()
        
        if not state:
            return "No saved session found. Start fresh with: python eugene_cli.py health"
        
        # Load project state
        project_state_file = Path(__file__).parent / "PROJECT_STATE.json"
        project_state = {}
        if project_state_file.exists():
            with open(project_state_file) as f:
                project_state = json.load(f)
        
        prompt = f"""# Resume Eugene Data Labs Session

## Context
I'm Rex, building Eugene Data Labs - a real-time financial data platform for AI agents.

## Session State (saved {state['saved_at']})

**Current Task:** {state['current_task']}

**Completed:**
{chr(10).join(f"- {t}" for t in state['completed_tasks'][-5:])}

**Next Steps:**
{chr(10).join(f"- {t}" for t in state['next_steps'][:5])}

**Notes:** {state.get('notes', 'None')}

## Recently Modified Files
{chr(10).join(f"- {f}" for f in state.get('files_modified', [])[:10])}

## Quick Commands
```bash
python eugene_cli.py health          # Check system status
python eugene_cli.py extract --ticker TSLA  # Test extraction
python eugene_cli.py batch --tickers TSLA AAPL  # Batch run
```

## What I Need Help With
{state['current_task']}

The codebase is in the `eugene/` directory. Key files:
- `eugene_cli.py` - Main CLI
- `extraction/parsers/debt.py` - Debt extraction
- `jobs/resilient_runner.py` - Batch processing with checkpoints
- `PROJECT_STATE.json` - Full project state

Please continue from where we left off.
"""
        return prompt
    
    def show(self):
        """Display current session state"""
        state = self.load()
        
        if not state:
            print("No saved session found.")
            return
        
        print("=" * 60)
        print("CURRENT SESSION STATE")
        print("=" * 60)
        print(f"Saved: {state['saved_at']}")
        print(f"Current Task: {state['current_task']}")
        print()
        
        print("Completed Tasks:")
        for task in state['completed_tasks'][-5:]:
            print(f"  ✓ {task}")
        print()
        
        print("Next Steps:")
        for step in state['next_steps'][:5]:
            print(f"  → {step}")
        print()
        
        if state.get('notes'):
            print(f"Notes: {state['notes']}")
            print()
        
        print("Recently Modified:")
        for f in state.get('files_modified', [])[:5]:
            print(f"  {f}")
    
    def quick_save(self, note: str):
        """Quick save with just a note"""
        existing = self.load() or {
            "current_task": "Building Eugene Data Labs",
            "completed_tasks": [],
            "next_steps": ["Test extraction", "Run batch", "Deploy API"]
        }
        
        return self.save(
            current_task=existing.get("current_task", note),
            completed_tasks=existing.get("completed_tasks", []),
            next_steps=existing.get("next_steps", []),
            notes=note
        )


# Convenience functions
def save_session(note: str = ""):
    """Quick save current session"""
    state = SessionState()
    state.quick_save(note or "Session checkpoint")
    return state.current_file


def get_resume_prompt() -> str:
    """Get prompt to resume with Claude"""
    state = SessionState()
    return state.generate_resume_prompt()


# CLI
def main():
    parser = argparse.ArgumentParser(description="Manage session state")
    subparsers = parser.add_subparsers(dest="command")
    
    # Save command
    save_parser = subparsers.add_parser("save", help="Save current session")
    save_parser.add_argument("--note", "-n", default="", help="Note about current state")
    save_parser.add_argument("--task", "-t", default="Building Eugene Data Labs", help="Current task")
    
    # Show command
    subparsers.add_parser("show", help="Show current session state")
    
    # Resume command
    subparsers.add_parser("resume", help="Get prompt to resume with Claude")
    
    args = parser.parse_args()
    
    state = SessionState()
    
    if args.command == "save":
        existing = state.load() or {}
        state.save(
            current_task=args.task,
            completed_tasks=existing.get("completed_tasks", [
                "Built extraction pipeline",
                "Added quality scoring",
                "Created resilient runner",
                "Built MCP server",
                "Created CLI"
            ]),
            next_steps=existing.get("next_steps", [
                "Test extraction on TSLA",
                "Validate quality scoring",
                "Run batch on 5 companies",
                "Test checkpoint resume"
            ]),
            notes=args.note
        )
    
    elif args.command == "show":
        state.show()
    
    elif args.command == "resume":
        prompt = state.generate_resume_prompt()
        print(prompt)
        
        # Also save to file
        resume_file = state.state_dir / "resume_prompt.md"
        with open(resume_file, 'w') as f:
            f.write(prompt)
        print(f"\n(Also saved to {resume_file})")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
