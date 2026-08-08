# CLAUDE.md

kladd is a fast, minimal markdown editor. The calm window where you read and
refine what you and your agents write.

## Vision

- Speed is the feature. Instant launch, no jank, nothing heavy on the hot path.
- Files on disk are the only truth. No hidden state, no lock-in, no sidecar
  metadata. Everything must render the same on GitHub.
- Never interrupt. No dialogs, prompts, or conflicts the user didn't ask for.
- Motion is feedback, not decoration. Subtle and fast (transform/opacity,
  never blocking input, honors reduced-motion). Done right it makes the app
  feel faster, not slower.
- Every feature must fight for its life. When in doubt, leave it out.

## How we build

- Smallest change that works. Prefer deleting code to adding it.
- Build primitives once, reuse them everywhere (motion, spacing, components).
  Shared code is why the whole app feels like one thing; a second
  implementation of something that exists is a bug.
- Follow each platform's conventions; the app should feel at home, not portable.
- Dependencies only when strictly necessary. A few lines of our own code
  always beats a package; every dependency must fight for its life like
  features do.
- Test behaviors that matter (the save/watch loop, editing), not coverage numbers.
- Scope creep goes to PLAN.md's roadmap, not into the current change.
