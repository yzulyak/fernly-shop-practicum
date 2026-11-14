#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

python3 -c '
import json
import re
import sys

payload = json.load(sys.stdin)
command = payload.get("command") or ""

is_playwright = bool(re.search(r"\bplaywright\b", command))
updates_snapshots = (
    "--update-snapshots" in command
    or bool(re.search(r"(^|[\s])-u([\s]|$)", command))
)

if is_playwright and updates_snapshots:
    message = (
        "Screenshot baselines change only through the visual-baselines "
        "workflow and a reviewed pull request."
    )
    json.dump(
        {
            "permission": "deny",
            "user_message": message,
            "agent_message": message,
        },
        sys.stdout,
    )
else:
    json.dump({"permission": "allow"}, sys.stdout)

print()
' <<<"$input"
