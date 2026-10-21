#!/bin/sh
# SessionStart hook: the plugin and the leed CLI ship as one release, so their
# versions should match. Silent when they do, and in every case it cannot judge;
# on a mismatch it prints one JSON object whose systemMessage tells the user
# which side to update.
#
# It must never fail or block a session, so every path ends in `exit 0`, and it
# uses only POSIX sh and base tools (no Node, no jq): the machine may have
# neither, which is what /leed:setup is for.

set +e
# Never wait on input.
exec </dev/null

SEMVER='^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*([-+][0-9A-Za-z.+-]*)?$'

root=${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}
manifest="$root/.claude-plugin/plugin.json"
[ -r "$manifest" ] || exit 0

plugin=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" 2>/dev/null | head -n 1)
printf '%s\n' "$plugin" | grep -Eq "$SEMVER" || exit 0
# The source tree (claude --plugin-dir) carries 0.0.0; only a build stamps a release.
[ "$plugin" = "0.0.0" ] && exit 0

# No CLI yet: /leed:setup installs it, so there is nothing to compare.
command -v leed >/dev/null 2>&1 || exit 0

# `leed --version` with a bound, so a hung binary cannot hold up the session.
# `timeout` is missing on stock macOS, hence the watchdog. Neither the watchdog
# nor leed may hold this script's stdout: a process left behind on that pipe
# (the watchdog's sleep, or a child of a killed leed) keeps the hook open after
# the script has exited. So on both paths leed writes to a file, and the
# watchdog to /dev/null. LEED_JSON is cleared because in JSON mode the version
# text goes to stderr and stdout holds only the JSON envelope.
cli_version_output() {
  out_file=$(mktemp 2>/dev/null) || return 1
  if command -v timeout >/dev/null 2>&1; then
    LEED_JSON= timeout 3 leed --version >"$out_file" 2>/dev/null
    rc=$?
  else
    LEED_JSON= leed --version >"$out_file" 2>/dev/null &
    pid=$!
    (sleep 3; kill "$pid") >/dev/null 2>&1 &
    watchdog=$!
    wait "$pid"
    rc=$?
    kill "$watchdog" >/dev/null 2>&1
  fi
  [ "$rc" -eq 0 ] && cat "$out_file"
  rm -f "$out_file"
  return $rc
}

# stderr dropped too: the shell reports a killed job ("Terminated") there.
output=$(cli_version_output 2>/dev/null) || exit 0
# Only stdout is read (a dev build prints a banner on stderr); the version is
# the last line that is one.
cli=$(printf '%s\n' "$output" | tr -d '\r' | grep -E "$SEMVER" | tail -n 1)
[ -n "$cli" ] || exit 0
[ "$cli" = "$plugin" ] && exit 0

# Returns 0 when release core $1 is older than $2, 1 when newer, 2 when equal.
compare_core() {
  a=${1%%[-+]*}
  b=${2%%[-+]*}
  for _ in 1 2 3; do
    x=${a%%.*}
    y=${b%%.*}
    [ "$x" -lt "$y" ] && return 0
    [ "$x" -gt "$y" ] && return 1
    a=${a#*.}
    b=${b#*.}
  done
  return 2
}

compare_core "$cli" "$plugin"
case $? in
  0) line="Leed CLI $cli is older than the Leed plugin $plugin. Update it with: /leed:setup" ;;
  1) line="The Leed plugin $plugin is older than the Leed CLI $cli. Update it with: claude plugin update leed@leed" ;;
  # Same release core, different pre-release or build: name both and point at
  # setup rather than guess a direction.
  *) line="The Leed CLI ($cli) and the Leed plugin ($plugin) are different builds. Run /leed:setup to line them up" ;;
esac

# Both versions matched SEMVER, so the line holds nothing that needs JSON escaping.
printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$line" "$line"
exit 0
