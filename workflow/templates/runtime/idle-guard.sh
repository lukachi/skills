#!/usr/bin/env bash
# Report a background command that has gone silent. Never decide for the agent.
#
# Duration is the wrong test: a talkative hour-long build is healthy and a
# silent loop is not. Silence only means nobody can tell from out here, so this
# reports and exits while the child keeps running. Exiting is the point — a
# finished background task is the only channel that reaches a working agent.
#
# The child writes to a regular file, never to a pipe. A stalled writer on a
# pipe blocks whoever reads it, which is how an earlier version of this script
# hung in exactly the way it exists to catch.

set -u
IDLE="${IDLE:-600}"
SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
POLL="${IDLE_GUARD_POLL:-2}"

usage() {
  echo "usage: idle-guard.sh --shell <command-string>" >&2
  echo "       idle-guard.sh --watch <pid> --log <path>" >&2
  exit 64
}

log_size() { wc -c <"$1" 2>/dev/null | tr -d ' ' || echo 0; }

report() {
  local pid="$1" quiet="$2" started="$3" log="$4" command="$5"
  local elapsed=$(( $(date +%s) - started ))
  {
    echo "idle-guard: no output for ${quiet}s — this is a prompt to check, not a verdict."
    echo "  command    : ${command}"
    echo "  pid        : ${pid}   still running, untouched"
    echo "  elapsed    : ${elapsed}s"
    ps -o time=,%cpu=,state= -p "$pid" 2>/dev/null \
      | sed 's/^ *//' | sed 's/^/  cpu,%,state: /'
    echo "  full log   : ${log}"
    echo "  last output:"
    tail -n 5 "$log" 2>/dev/null | sed 's/^/    | /'
    echo
    echo "  Silence is not evidence of failure. Do NOT kill or restart on this"
    echo "  report alone, and do NOT agree that something is wrong because it was"
    echo "  reported. Establish it: compare cpu time against elapsed, then check"
    echo "  the data the job writes. Never check by matching a process name — a"
    echo "  pattern matches the checking shell too, which is how silent waiting"
    echo "  gets mistaken for progress. Restarting healthy work is the more"
    echo "  expensive mistake."
    echo
    echo "  re-arm : IDLE=${IDLE} bash \"${SELF}\" --watch ${pid} --log ${log} &"
    echo "  abandon: kill -KILL ${pid}"
  } >&2
}

watch_pid() {
  local pid="$1" log="$2" command="$3" started="$4"
  local last size quiet
  last=$(date +%s)
  size=$(log_size "$log")
  while kill -0 "$pid" 2>/dev/null; do
    sleep "$POLL"
    local now
    now=$(log_size "$log")
    if [ "$now" != "$size" ]; then size="$now"; last=$(date +%s); fi
    quiet=$(( $(date +%s) - last ))
    if [ "$quiet" -ge "$IDLE" ]; then
      report "$pid" "$quiet" "$started" "$log" "$command"
      return 125
    fi
  done
  return 0
}

case "${1:-}" in
--shell)
  [ $# -eq 2 ] || usage
  command="$2"
  log="${TMPDIR:-/tmp}/idle-guard.$$.log"
  : >"$log"
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL bash -c "$command" >"$log" 2>&1 &
  else
    bash -c "$command" >"$log" 2>&1 &
  fi
  child=$!
  tail -n +1 -f "$log" 2>/dev/null &
  streamer=$!
  # Drop it from the job table so terminating it does not print job-control
  # noise into the output the agent reads.
  disown "$streamer" 2>/dev/null || true
  started=$(date +%s)
  watch_pid "$child" "$log" "$command" "$started"
  stalled=$?
  kill "$streamer" 2>/dev/null
  if [ "$stalled" -eq 125 ]; then
    # Leave the child and its log in place: the agent decides, and --watch
    # re-arms onto the same pair without losing a second of work.
    exit 125
  fi
  wait "$child"
  code=$?
  rm -f "$log"
  exit "$code"
  ;;
--watch)
  [ $# -eq 4 ] && [ "$3" = "--log" ] || usage
  pid="$2"
  log="$4"
  started=$(date +%s)
  watch_pid "$pid" "$log" "(re-armed watch on pid $pid)" "$started"
  stalled=$?
  [ "$stalled" -eq 125 ] && exit 125
  echo "idle-guard: pid ${pid} finished; its output is in ${log}" >&2
  exit 0
  ;;
*)
  usage
  ;;
esac
