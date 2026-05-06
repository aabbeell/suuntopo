---
name: build-suuntopo
description: Use this skill when Vitya wants to ship a new build of a SUUNTOPO watch app — typed as "/build-suuntopo <app>", "build canvas", "ship a new hwtest3", or any request to package, version, changelog, commit, and push a SuuntoPlus build. Handles version bump, moving fresh .fea/.zip artifacts into builds/<app>/v<version>/, generating a changelog entry from the git diff, capturing optional tester feedback, committing, tagging <app>-v<version>, and pushing to origin.
---

# /build-suuntopo — release a new SuuntoPlus build

Use this for the SUUNTOPO repo's per-app release workflow. One invocation = one new versioned build of one app, recorded in CHANGELOG.md, tagged, pushed.

## Inputs

The user invokes this skill in one of these forms:

- `/build-suuntopo canvas` — bump the patch part of the manifest version automatically
- `/build-suuntopo canvas 0.4` — bump to the explicit version `0.4`
- `/build-suuntopo canvas --feedback "tested on Race S, screen scroll smooth"` — record tester feedback in the changelog
- `/build-suuntopo canvas --auto` — generate the changelog purely from the diff, skip asking for tester feedback

The first positional arg is the app slug. Allowed slugs are exactly the directory names under `src/` that contain a `manifest.json`:

- `suuntopo_canvas` (or short alias `canvas`)
- `suuntopo_image` (or `image`)
- `suuntopo_hwtest` (or `hwtest`)
- `suuntopo_hwtest2` (or `hwtest2`)
- `suuntopo_hwtest3` (or `hwtest3`)

If no app is given, list the apps and ask which one. If the alias is ambiguous, ask.

## Workflow

Follow these steps in order. Do not skip steps. The whole thing should take one short conversation turn unless the user asks for tester feedback interactively.

### 1. Resolve the app and check working tree

```bash
cd /Users/abelboros/Documents/HOBO/SUUNTOPO
git status --porcelain
```

Resolve the alias to a full slug. Map `canvas` → `suuntopo_canvas`, `image` → `suuntopo_image`, `hwtest` → `suuntopo_hwtest`, etc. If the working tree has uncommitted changes outside `src/<slug>/`, `builds/<slug>/`, `CHANGELOG.md`, and `manifest.json`, list them and ask the user to commit/stash before continuing — the skill must not bury unrelated changes inside the build commit.

### 2. Read the current manifest version

```bash
cat src/<slug>/manifest.json
```

Pull out `version` (e.g. `"0.3"`). Versions in this repo are loose `MAJOR.MINOR` strings (sometimes `MAJOR.MINOR.PATCH`). Treat each dot-segment as a separate integer.

### 3. Compute the new version

- If the user provided an explicit version (e.g. `0.4`), use that.
- Otherwise auto-bump the **last** segment by 1 (`0.3` → `0.4`, `0.3.1` → `0.3.2`).
- Verify `builds/<slug>/v<new-version>/` does not already exist. If it does, that version was already shipped — refuse and ask the user for a different version.

### 4. Show the diff since the previous tagged version

```bash
git tag --list "<slug>-*" --sort=-v:refname | head -5
git log --oneline <slug>-<prev-version>..HEAD -- src/<slug>/
git diff <slug>-<prev-version>..HEAD -- src/<slug>/
```

If no `<slug>-*` tag exists yet (first release through the skill), diff against the initial baseline commit instead:

```bash
git log --oneline -- src/<slug>/
git diff $(git rev-list --max-parents=0 HEAD)..HEAD -- src/<slug>/
```

Read the diff. Summarize the actual functional changes — not "modified manifest.json" but what the change *does* (e.g. "Anchor selection now wraps around at the last station", "Reduced canvas redraw cost in the info panel"). Three to seven concise bullets is the right length. Skip pure formatting changes and version-bump-only diffs.

### 5. Bump the manifest

Edit `src/<slug>/manifest.json` and replace the `version` value with the new version. Leave everything else untouched.

### 6. Wait for the user to build inside VS Code

Print:

> Open VS Code, right-click `src/<slug>/` in the SuuntoPlus panel, and click **Build**. Reply "built" when the new `.fea` files have appeared next to the source.

(Do **not** try to invoke `suuntoplus.buildAppDefault` via `code --command` — the SuuntoPlus extension's commands need an active editor context and don't reliably run from the CLI. The user does the build click; the skill handles everything else.)

When the user confirms, list the freshly built artifacts:

```bash
ls -la src/<slug>/*.fea src/<slug>/*.zip 2>/dev/null
```

Sanity-check: at least the `-q` variant (Race S, the primary target) must be present. If `<slug>-q.fea` or equivalent is missing, stop and tell the user the build did not complete.

### 7. Move artifacts into `builds/<slug>/v<new-version>/`

```bash
mkdir -p builds/<slug>/v<new-version>/
mv src/<slug>/*.fea builds/<slug>/v<new-version>/
mv src/<slug>/*.zip builds/<slug>/v<new-version>/ 2>/dev/null || true
ln -sfn v<new-version> builds/<slug>/latest
```

The `latest` symlink lets testers always grab the most recent build with a stable path: `builds/<slug>/latest/<app>-q.fea`.

### 8. Collect tester feedback (or auto-skip)

- If `--feedback "<text>"` was passed: use that text verbatim.
- If `--auto` was passed: skip; the changelog uses only the diff summary.
- Otherwise: ask the user once, "Any tester feedback to record for this build? (reply text, or 'skip')". Wait for the reply.

Tester feedback is recorded as a separate sub-section in the changelog entry, attributed to the build version. Do not invent feedback — if the user skips or `--auto` is set, omit the section entirely.

### 9. Update `CHANGELOG.md`

Insert a new entry directly under the `## [Unreleased]` heading, in this shape:

```markdown
## [<slug>-v<new-version>] — YYYY-MM-DD

### Changed
- bullet 1 from the diff summary
- bullet 2 …

### Tester feedback
- (only if provided) the feedback text, verbatim
```

Use the actual current date (you can read it from the system context). Do not collapse multiple apps into the same section — each build gets its own dated entry. Leave the rest of the changelog alone.

### 10. Commit, tag, push

Stage exactly:

- `src/<slug>/manifest.json` (the version bump)
- `builds/<slug>/v<new-version>/` (the new artifacts)
- `builds/<slug>/latest` (the updated symlink)
- `CHANGELOG.md`

```bash
git add src/<slug>/manifest.json builds/<slug>/v<new-version>/ builds/<slug>/latest CHANGELOG.md
git commit -m "<slug> v<new-version>

<one-line summary of the headline change>

<diff bullets, one per line>"
git tag <slug>-v<new-version>
git push origin main
git push origin <slug>-v<new-version>
```

Commit message style: short subject line `<slug> v<new-version>`, blank line, one-line headline, blank line, diff bullets. Do **not** mention Claude or Claude Code in the commit message or anywhere else (per global CLAUDE.md instruction).

If the user is offline or the push fails, tell them what to run manually: `git push origin main && git push origin <slug>-v<new-version>`.

### 11. Report

End with a one-liner: `Shipped <slug> v<new-version>. Tag: <slug>-v<new-version>. Build artifacts: builds/<slug>/v<new-version>/`. Nothing more.

## Things to refuse

- Building an app that does not exist under `src/`.
- A version that already has a `builds/<slug>/v<version>/` directory.
- A build commit on top of unrelated uncommitted changes (see step 1).
- Committing if the `-q` variant `.fea` is missing — the primary watch target was not built.

## Edge cases

- **First-ever build via this skill:** there is no `<slug>-v<prev>` tag. Diff against the initial commit. The changelog entry is the first one for this app under the skill.
- **No `.fea` outputs found:** the build inside VS Code didn't run, or the user replied "built" too early. Ask them to check the SuuntoPlus output panel and try again.
- **User cancels mid-flow:** if they say to abort after step 5 (manifest already bumped) but before step 7, revert the manifest with `git checkout src/<slug>/manifest.json`. Do not leave the working tree dirty.
- **`topo_editor`:** has no manifest, so it does not have a build flow. If the user asks to "build topo_editor", tell them it's a static HTML editor and just needs a regular git commit.
