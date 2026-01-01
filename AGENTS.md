# AGENTS.md

## Command runs + logging
If the user asks you to "run commands and paste outputs into logs/setup.md":
- Create `logs/` and `logs/setup.md` if missing.
- Capture stdout+stderr for each command and append to `logs/setup.md`.
- Do not ask follow-up questions if the user provided a command list; run it.
- Stop on first failure and report the failing command + exit code.
