---
name: interactive-testing
description: Test and debug sly's interactive mode in a controlled tmux terminal. Use for TUI behavior checks and interactive release smoke tests.
---

# Testing sly Interactive Mode with tmux

Run the TUI in a controlled terminal (from the repo root, two directories above this skill):

```bash
tmux new-session -d -s sly-test -x 80 -y 24
tmux send-keys -t sly-test "./sly-test.sh" Enter
sleep 3 && tmux capture-pane -t sly-test -p     # capture after startup
tmux send-keys -t sly-test "your prompt here" Enter
tmux send-keys -t sly-test Escape               # special keys (also C-o for ctrl+o, etc.)
tmux kill-session -t sly-test
```

For release smoke tests, start the tmux session with `-c /tmp` and replace `./sly-test.sh` with the absolute path to the release binary. Test both Node and Bun binaries separately, submit a prompt, and wait for the model reply; startup alone is not a passing smoke test.
