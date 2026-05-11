# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | C:\Users\ander\.config\opencode\skills\branch-pr\SKILL.md |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | C:\Users\ander\.config\opencode\skills\go-testing\SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | C:\Users\ander\.config\opencode\skills\issue-creation\SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen". | judgment-day | C:\Users\ander\.config\opencode\skills\judgment-day\SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | C:\Users\ander\.config\opencode\skills\skill-creator\SKILL.md |
| When users ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or want to extend capabilities. | find-skills | C:\Users\ander\.agents\skills\find-skills\SKILL.md |
| For interface design work on dashboards, admin panels, apps, tools, and interactive products; not for marketing pages. | interface-design | C:\Users\ander\.agents\skills\interface-design\SKILL.md |
| Interact with Notion using the unofficial private API when the private CLI workflow is needed. | vibe-notion | C:\Users\ander\.agents\skills\vibe-notion\SKILL.md |
| Interact with Notion workspaces using the official API when integration-token access is needed. | vibe-notionbot | C:\Users\ander\.agents\skills\vibe-notionbot\SKILL.md |
| When asked to review UI, accessibility, UX, or best-practice compliance against web interface guidelines. | web-design-guidelines | C:\Users\ander\.agents\skills\web-design-guidelines\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Every PR MUST link an approved issue and MUST carry exactly one `type:*` label.
- Use branch names `type/description` matching `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`.
- Use conventional commits only; never add `Co-Authored-By` trailers.
- PR body MUST include issue linkage, one PR type, summary bullets, changes table, test plan, and checklist.
- Run shellcheck on modified shell scripts before opening the PR.
- Do not expect mergeability until automated checks for issue reference, approval label, PR label, and shellcheck pass.

### go-testing
- Prefer table-driven tests for pure logic and multi-case behavior.
- Test Bubbletea state transitions directly through `Model.Update()` before reaching for higher-level flows.
- Use `teatest.NewTestModel()` for interactive TUI flows and key-sequence scenarios.
- Use golden files for stable view/output assertions; store fixtures in `testdata/`.
- Use `t.TempDir()` for file-system tests and interfaces/mocks for side effects.
- Cover both success and error paths explicitly.

### issue-creation
- Issues MUST use templates; blank issues are disabled.
- Search for duplicates before creating a new issue.
- New issues get `status:needs-review`; PRs must wait for maintainer `status:approved`.
- Questions belong in Discussions, not Issues.
- Use bug template for defects and feature template for enhancements.
- Fill all required fields and keep reproduction steps / problem statements concrete.

### judgment-day
- Use only when the user explicitly asks for judgment-day style adversarial review.
- Resolve project standards from the skill registry BEFORE launching judges.
- Launch two blind judges in parallel; neither judge knows about the other.
- Treat findings confirmed by both judges as highest confidence.
- Classify warnings as `real` vs `theoretical`; only real warnings block approval.
- After confirmed fixes, re-judge; after two fix iterations, escalate to the user before continuing.

### skill-creator
- Create a skill only for reusable, non-trivial patterns or workflows.
- Follow the standard `skills/{skill-name}/SKILL.md` structure and include complete frontmatter.
- Put the most critical patterns first; keep code examples minimal and focused.
- Use `assets/` for templates/schemas and `references/` for LOCAL docs only.
- Do not add keyword sections, long explanations, or web URLs in references.
- Register new skills in `AGENTS.md` after creation.

### find-skills
- Use `npx skills find <query>` to search the ecosystem before assuming a capability is unavailable.
- Identify the domain and concrete task first so the search query is specific.
- Present the skill name, purpose, install command, and skills.sh link to the user.
- If the user wants installation, use `npx skills add <owner/repo@skill> -g -y`.
- If no relevant skill exists, offer direct help and suggest `npx skills init` for creating one.

### interface-design
- Use only for product interfaces such as dashboards, admin panels, apps, and tools; never for marketing pages.
- Start from intent: who the user is, what they must do, and how the interface should feel.
- Explicitly explore domain concepts, color world, signature element, and default patterns before proposing direction.
- Every visual choice must have a WHY; generic defaults are considered failure.
- Run swap, squint, signature, and token checks before presenting output.
- Keep typography, color, spacing, and structure consistent with the stated intent systemically.

### vibe-notion
- Always use the `vibe-notion` CLI; never call Notion private APIs directly.
- Prefer `vibe-notion` when the Notion desktop app is available; it auto-extracts `token_v2`.
- Never write automation scripts for bulk work; use the CLI `batch` command instead.
- Read and maintain `~/.config/vibe-notion/MEMORY.md` for workspace/page/database IDs and user preferences.
- Never store credentials or full page content in memory.
- If the CLI lacks a feature, explain the limitation instead of bypassing the tool.

### vibe-notionbot
- Always use the `vibe-notionbot` CLI; never call the official Notion API directly.
- Use it when `NOTION_TOKEN` integration auth is available and desktop-app private auth is not preferred.
- Never write scripts for bulk operations; use `batch` with files instead.
- Prefer `vibe-notion` over `vibe-notionbot` when both are available unless official API constraints require the bot path.
- Keep operations within official API-supported capabilities; do not improvise unsupported endpoints.
- Treat tokens and workspace data as sensitive; never persist secrets.

### web-design-guidelines
- Fetch the latest guideline source before every review.
- Read the target files or ask the user for file scope if none was provided.
- Evaluate code against the fetched rules, not stale cached assumptions.
- Output findings in the exact terse `file:line` format required by the guideline source.
- Use this skill for UI, accessibility, UX, and interface best-practice reviews only.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| — | — | No project-level convention files found in `C:\Users\ander\Downloads\reto-bot`. |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
