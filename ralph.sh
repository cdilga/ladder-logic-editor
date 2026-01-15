#!/bin/bash

# ralph.sh - Loop Claude Code with a prompt file until "done" or max iterations

set -e

# Defaults
PROMPT_FILE="prompt.md"
MAX_ITERATIONS=0  # 0 = infinite
DONE_PATTERN="RALPH_DONE_SECRET"  # Use a unique marker unlikely to appear accidentally

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Loop Claude Code with a prompt file until "done" is detected or max iterations reached.

Options:
    -p, --prompt FILE       Prompt file to use (default: prompt.md)
    -m, --max-iterations N  Maximum iterations, 0 for infinite (default: 0)
    -d, --done-pattern PAT  Pattern to detect completion (default: "RALPH_DONE")
    -h, --help              Show this help message

Examples:
    $(basename "$0")
    $(basename "$0") -m 5
    $(basename "$0") -p my_task.md -m 10
    $(basename "$0") --max-iterations 3 --done-pattern "task complete"
EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--prompt)
            PROMPT_FILE="$2"
            shift 2
            ;;
        -m|--max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        -d|--done-pattern)
            DONE_PATTERN="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate prompt file exists
if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "Error: Prompt file '$PROMPT_FILE' not found."
    exit 1
fi

echo "Starting ralph loop..."
echo "  Prompt file: $PROMPT_FILE"
echo "  Max iterations: $( [[ $MAX_ITERATIONS -eq 0 ]] && echo "infinite" || echo "$MAX_ITERATIONS" )"
echo "  Done pattern: $DONE_PATTERN"
echo ""

iteration=0

while :; do
    ((iteration++))
    
    echo "========== Iteration $iteration =========="
    
    # Run claude in print mode, show output and capture it
    claude -p "$(cat "$PROMPT_FILE")" --dangerously-skip-permissions 2>&1 | tee /tmp/ralph_output_$$.txt
    
    # Check for done pattern
    if grep -qi "$DONE_PATTERN" /tmp/ralph_output_$$.txt 2>/dev/null; then
        echo ""
        echo "Done pattern '$DONE_PATTERN' detected in output:"
        grep -i "$DONE_PATTERN" /tmp/ralph_output_$$.txt | head -1
        echo ""
        echo "Stopping after $iteration iteration(s)."
        rm -f /tmp/ralph_output_$$.txt
        break
    fi
    
    # Check max iterations
    if [[ $MAX_ITERATIONS -gt 0 && $iteration -ge $MAX_ITERATIONS ]]; then
        echo ""
        echo "Max iterations ($MAX_ITERATIONS) reached. Stopping."
        rm -f /tmp/ralph_output_$$.txt
        break
    fi
    
    rm -f /tmp/ralph_output_$$.txt
    echo ""
done

echo "Ralph finished."