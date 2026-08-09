# kladd

Norwegian for "rough draft". A fast, minimal, cross-platform markdown editor built for people who work in plain files and alongside AI agents. The calm window where you read and refine what you and your agents write.

## Positioning

Not another notes app. The gap it fills:

- Obsidian's live-preview editing feel, without the vault, plugins, or Electron weight.
- Agent-native: external tools rewrite files you have open and the editor just keeps up. No conflict dialogs, ever.
- Standard files only. Everything renders identically on GitHub. No dialect, no hidden metadata folders, no lock-in.

## Locked decisions

| Decision        | Choice                                                      | Why                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platforms       | macOS + Windows from day one                                | User works on both                                                                                                                                                                                                                                                                                                                      |
| Stack           | Tauri 2 + CodeMirror 6                                      | ~10MB binary, OS webview, built-in updater. Obsidian's editor is CM6, so the exact editing feel is reachable with a proven engine. Known tax: WKWebView (macOS) vs WebView2 (Windows) rendering differences, test on both                                                                                                               |
| UI framework    | React 19 + Tailwind + Zustand                               | Validated by [writer-computer](https://github.com/joelbqz/writer-computer), a Tauri + React 19 + CM6 markdown editor that feels snappy in practice. Familiar stack, best AI-codegen support. kladd is built from scratch, not a fork: writer-computer (GPL-3.0, not accepting PRs, low activity) is inspiration only, never copied code |
| License         | MIT                                                         | No code is borrowed from GPL projects, so nothing forces copyleft. MIT is the convention for open-source dev tools                                                                                                                                                                                                                      |
| Tooling         | Vite+ (`vite-plus`)                                         | VoidZero's unified toolchain: Vite, Vitest, Oxc-based lint/format, package management in one CLI. MIT, actively developed, pre-1.0 (accept some churn). Fallback is plain Vite + Biome + pnpm, a config change not a rewrite                                                                                                            |
| Rust crates     | `notify` for file watching; `grep`/`ignore` for v0.4 search | The standards; ripgrep's own internals for search rather than shelling out                                                                                                                                                                                                                                                              |
| Design language | Tokens in `src/tokens.css`                                  | Linear-style crisp chrome around a calm editor pane. System fonts, light/dark via `light-dark()` with a settings override. Color, shape, and motion tokens (durations, easings, honors reduced-motion) in one file; Tailwind 4 utilities consume them. Components are ours (Menu, Overlay primitives). No component library             |
| File model      | Folder-first                                                | Open any folder or single file. The folder is the state; no vault, no sidecar metadata. Git-ness is detected, not declared: a folder with `.git` gets git affordances, a plain folder doesn't. A GitHub repo is just a cloned folder                                                                                                    |
| Git             | Commit/push/pull only, via system `git` binary              | Shelling out inherits the user's SSH signing, hooks, and credential helpers for free. No branch UI, no staging concept, no merge tooling. Git-generic (works with GitLab/ADO too); GitHub-specific sugar comes later                                                                                                                    |
| Markdown        | GFM + YAML frontmatter + Mermaid                            | Exactly what AI tools emit and GitHub renders. No wikilinks: they drag the vault model back in                                                                                                                                                                                                                                          |
| Save model      | Auto-save with atomic writes                                | Always safe to close. Combined with file watching, editor and agents converge on disk state. Same-second conflicts resolve last-writer-wins (acceptable for v1)                                                                                                                                                                         |
| AI angle        | Live external edits + agent-friendly rendering              | No built-in chat. The app is the viewing pane for agent work, not another AI client                                                                                                                                                                                                                                                     |
| Distribution    | Open-source, GitHub releases, Tauri updater                 | Apple signing from day one (account exists). Windows signing deferred until there are Windows users (Azure Trusted Signing when needed)                                                                                                                                                                                                 |

## MVP (v0.1)

The bar: opens instantly, edits like Obsidian, never fights an agent.

### Editor (the hard 70%)

- CodeMirror 6 live preview: raw markdown on the active line, rendered text everywhere else. This is the make-or-break component; spike it first before building anything around it.
- GFM: tables, task lists (clickable checkboxes), strikethrough, autolinks, fenced code with syntax highlighting.
- YAML frontmatter rendered as a tidy collapsed block.
- Mermaid diagrams rendered inline. The mermaid library is the heaviest dependency in the app: lazy-load it only when a document contains a diagram, so launch stays instant.
- GitHub callouts (`> [!NOTE]`, `> [!WARNING]`, …) rendered as styled blocks.
- In-file find & replace.
- Raw source mode toggle.

### Agent-native file handling

- Watch open files; external changes reload instantly with cursor and scroll preserved.
- Auto-save (debounced, atomic write-to-temp-then-rename).
- No "file changed on disk" dialogs anywhere in the app.

### Shell

- Open folder or single file. Minimal toggleable file tree.
- Recent folders + in-place folder switching: swap the window's workspace (local folder or cloned repo) without opening a new window.
- Tabs.
- Quick switcher (cmd+P fuzzy file search).
- Native menus and platform-standard shortcuts on both OSes.
- File operations: new file (⌘N), new folder, rename, delete-to-trash — inline in the tree, no dialogs.
- Display names from file content: tree, tabs, and switcher show frontmatter `title:`, else the first `# H1`, else the filename. Files only — folders keep their real names. The name lives inside the file (disk stays the only truth; no sidecar metadata, ever). Switcher matches display name and filename both.
- Full keyboard navigation: every action reachable without a mouse (tree, tabs, menus, dialogs).
- Session restore: reopen last folder and tabs on launch.
- Settings window on cmd+, : one clean, well-organized pane that grows with the app. Few settings at v0.1 is a feature.
- System light/dark, system fonts, no theming engine.
- `kladd .` CLI opener.

### Ship it

- Signed + notarized macOS build, unsigned Windows build.
- Tauri updater against GitHub releases. Homebrew cask.

### Build order

1. Editor spike: CM6 live preview standing alone in a browser tab, written from scratch (writer-computer and other open implementations as inspiration for the approach, not source). Kill or commit based on this.
2. Tauri shell: folder open, tree, tabs, quick switcher, folder switching.
3. Save/watch loop: auto-save + file watching + cursor-preserving reload. Test by pointing Claude Code at an open file.
4. Daily drivability (done, swapped ahead of rendering): file operations, settings (theme, autosave delay), keyboard-complete tree and menus, crisp UI pass.
5. Rendering completeness: frontmatter, Mermaid, callouts, tables, find & replace, raw source toggle.
6. Release pipeline: signing, notarization, updater, cask.

## Foundation (in place)

Cheap now, expensive later. Most of it comes with the toolchain:

- Tool versions pinned in `mise.toml` (node, pnpm, vite-plus). `mise install`
  once per clone puts `vp` on PATH.
- Format/lint/typecheck: `vp fmt`, `vp lint`, `vp check` (oxfmt/oxlint, zero config).
- Tests: `vp test` (Vitest via `vite-plus/test`). Test behaviors that matter:
  the livePreview decoration logic is pure (state + ranges in, decorations
  out) and unit-tested without a DOM; the save/watch loop gets integration
  tests when it exists.
- Pre-commit hook (`.githooks/pre-commit`) runs `vp check` (~2s). Enable once
  per clone: `git config core.hooksPath .githooks`. No pre-push hook:
  anything slower than a second lives in CI.
- CI: GitHub Actions, one job (check + test) with path filters,
  cancel-in-progress, and a 5-minute timeout cap; free-tier minutes are the
  constraint while the repo is private. CodeQL needs a public repo (or paid
  Advanced Security): add it back when kladd goes public. Platform builds on
  tags come with the release pipeline (build order step 6); note macOS
  runners bill 10x minutes.

## Roadmap

Ordered. Nothing here starts before v0.1 ships.

- **v0.2 — Paste intelligence.** Paste image: saved to an assets folder, link inserted. Paste URL over selection: becomes a link. Paste HTML: converted to clean markdown. Small feature, used fifty times a day.
- **v0.3 — Git integration.** Dirty-state indicator; commit dialog with message field and changed-file list (uncheck to exclude); Commit / Commit & Push; pull/sync; "Clone from URL…"; "Initialize repository" on a plain folder; "Open on GitHub". All via the system `git` binary.
- **v0.4 — Folder-wide search.** Ripgrep-backed content search across the open folder.
- **Later, in rough priority:**
  - Heading minimap: subtle tick lines along the editor edge, one per heading, sized by level. Hovering shows the heading text in a popover; click jumps. No panel, no chrome. Best single feature for long agent-written docs.
  - GitHub sugar: OAuth device flow, "clone from my repos" picker, one-click "publish folder to GitHub".
  - Agent integration, t3code-style: drive a coding agent from within the app. Claude Code first, others maybe later. AI-generated commit messages come from this, not from raw provider API keys.
  - Snapshot history: rolling local file snapshots with a "what changed" timeline. Safety net for agent clobbers.
  - External-change highlighting: subtle diff of what an agent changed since you last looked.
  - Inline diffs in the commit dialog: review what changed per file before committing.
  - Split panes: two files side by side in one window.
  - Table editing UX: tab between cells, auto-align, row/column shortcuts.
  - Spellcheck: native OS webview spellcheck, toggleable.
  - Word count / reading time in the status bar, selection-aware.
  - Focus / typewriter mode: dim inactive paragraphs, keep cursor line centered.
  - Global quick-capture: system-wide hotkey opens a floating scratchpad that appends to a designated inbox.md.
  - Pinned files: pin frequent files to the top of the tree/switcher.
  - Command palette (once there are enough commands to justify it).
  - Export and copy-as: styled PDF/HTML, rich text for Slack/Outlook.
  - Windows code signing + winget manifest.

## Considered and dropped

So we don't relitigate: KaTeX math, vim keybindings, file templates, footnotes, print support (folded into export if it ever happens), presentation mode, relative-link autocomplete/validation, menu bar quick note, shadcn/styled component libraries (components are ours, built on tokens.css; headless primitives like Radix/Base UI may be reconsidered narrowly for menu/dialog a11y if hand-rolled keyboard handling becomes a burden).

## Non-goals

Permanent, not deferred:

- No plugin system.
- No general-purpose AI chat and no LLM-provider sprawl. Agent integration (Claude Code) is a planned roadmap item; that is the only AI door, and it stays shut until the editor and git story are done.
- No git branch/staging/merge UI. Commit, push, pull is the ceiling.
- No "workspace" concept above folders. A repo is a folder; switching folders is the switching model.
- No wikilinks, backlinks, or graph view.
- No sync service, no accounts, no telemetry.
- No mobile.
