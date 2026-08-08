# CLAUDE.md

kladd is a fast, minimal markdown editor. The calm window where you read and
refine what you and your agents write.

## Vision

- Speed is the feature. Instant launch, no jank, nothing heavy on the hot path.
- Files on disk are the only truth. No hidden state, no lock-in, no sidecar
  metadata. Everything must render the same on GitHub.
- Never interrupt. No dialogs, prompts, or conflicts the user didn't ask for.
- Every feature must fight for its life. When in doubt, leave it out.

## How we build

- Smallest change that works. Prefer deleting code to adding it.
- Follow each platform's conventions; the app should feel at home, not portable.
- No new dependency for what a few lines can do.
- Test behaviors that matter (the save/watch loop, editing), not coverage numbers.
- Scope creep goes to PLAN.md's roadmap, not into the current change.
