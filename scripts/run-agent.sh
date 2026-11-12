#!/usr/bin/env bash
# run-agent.sh — run Cursor agent with a visible trail of tool calls.
# Usage: run-agent.sh <prompt-file> <result-file> <trail-file>
# Bash 3.2 compatible.
set -euo pipefail

usage() {
  echo "usage: run-agent.sh <prompt-file> <result-file> <trail-file>" >&2
}

if [ $# -ne 3 ]; then
  usage
  exit 1
fi

PROMPT_FILE="$1"
RESULT_FILE="$2"
TRAIL_FILE="$3"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "run-agent: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "run-agent: agent CLI not on PATH" >&2
  exit 1
fi

: >"$TRAIL_FILE"
: >"$RESULT_FILE"

PROMPT_TEXT="$(cat "$PROMPT_FILE")"

AGENT_PATH="${PATH:-/usr/bin:/bin}"
AGENT_HOME="${HOME:-/tmp}"
AGENT_TMPDIR="${TMPDIR:-/tmp}"
AGENT_API_KEY="${CURSOR_API_KEY:-}"

PARSER="$(mktemp "${TMPDIR:-/tmp}/run-agent-parse.XXXXXX")"
cat >"$PARSER" <<'PY'
import json
import sys

last_message = ""
result_path = sys.argv[1]

def tool_label(tool_call):
    if not isinstance(tool_call, dict) or not tool_call:
        return "unknown", ""
    name = next(iter(tool_call.keys()))
    body = tool_call.get(name) or {}
    args = body.get("args") if isinstance(body, dict) else None
    detail = ""
    if isinstance(args, dict):
        for key in ("command", "path", "pattern", "query", "glob_pattern", "file_path"):
            if key in args and args[key] is not None:
                detail = str(args[key])
                break
        if not detail and args:
            detail = json.dumps(args, ensure_ascii=False)[:200]
    elif isinstance(body, dict) and isinstance(body.get("function"), dict):
        fn = body["function"]
        name = fn.get("name") or name
        detail = str(fn.get("arguments") or "")[:200]
    short = name.replace("ToolCall", "")
    return short, detail

try:
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        etype = event.get("type")
        if etype == "assistant":
            message = event.get("message") or {}
            parts = message.get("content") or []
            texts = []
            for part in parts:
                if isinstance(part, dict) and part.get("type") == "text":
                    texts.append(part.get("text") or "")
            if texts:
                last_message = "".join(texts)
        elif etype == "tool_call" and event.get("subtype") == "started":
            short, detail = tool_label(event.get("tool_call") or {})
            if detail:
                sys.stdout.write("agent tool: %s %s\n" % (short, detail))
            else:
                sys.stdout.write("agent tool: %s\n" % short)
            sys.stdout.flush()
        elif etype == "result":
            result_text = event.get("result")
            if isinstance(result_text, str) and result_text.strip() and not last_message.strip():
                last_message = result_text
finally:
    with open(result_path, "w", encoding="utf-8") as fh:
        fh.write(last_message)
        if last_message and not last_message.endswith("\n"):
            fh.write("\n")
PY

# Stream NDJSON into the trail while printing one live line per tool call.
# The last tool line stays on screen if the agent hangs — that is the stuck command.
set +e
env -i \
  PATH="$AGENT_PATH" \
  HOME="$AGENT_HOME" \
  TMPDIR="$AGENT_TMPDIR" \
  CURSOR_API_KEY="$AGENT_API_KEY" \
  agent -p --force --trust --output-format stream-json -- "$PROMPT_TEXT" \
  2>"$TRAIL_FILE.err" \
  | tee -a "$TRAIL_FILE" \
  | python3 "$PARSER" "$RESULT_FILE"
# Capture all statuses before any other command resets PIPESTATUS (set -u safe).
statuses="${PIPESTATUS[*]}"
set -e
set -- $statuses
agent_rc=${1:-0}
tee_rc=${2:-0}
parse_rc=${3:-0}

if [ -s "$TRAIL_FILE.err" ]; then
  cat "$TRAIL_FILE.err" >&2 || true
fi

rm -f "$PARSER" "$TRAIL_FILE.err"

if [ "$agent_rc" -ne 0 ]; then
  exit "$agent_rc"
fi
if [ "$tee_rc" -ne 0 ]; then
  exit "$tee_rc"
fi
exit "$parse_rc"
