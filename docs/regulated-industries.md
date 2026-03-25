# Regulated Industries

## The Structural Fit

Most regulated industries share three properties:

1. **Maker-checker controls** — no person can both create and approve the same work product
2. **Audit requirements** — every action must be attributable, timestamped, and retrievable
3. **Exception workflows** — deviations from expected outputs must be flagged, investigated, and resolved with a documented rationale

Git workflows have the same three properties, structurally:

| Financial / Regulated Control | Git Equivalent | How It Works |
|---|---|---|
| Maker-checker approval | Pull request merge | Agent (maker) opens PR; human reviewer (checker) approves before merge |
| Audit trail | `git log` | Every action is a commit — immutable, timestamped, attributable to the agent |
| Segregation of duties | Branch protection | Agent cannot merge its own branch; reviewer role is enforced by branch rules |
| Control documentation | `RULES.md` | Agent's constraints are in version control, reviewed, and auditable |
| Point-in-time snapshot | `git tag` | Signed-off state of work is a tag on main — `v2025-01-close`, `v2025-Q1-audit` |
| Exception log | Exception commits + PR comments | Unresolved items are committed as exceptions; resolution is recorded on the PR |
| Institutional knowledge | `memory/MEMORY.md` | Prior resolutions, patterns, and context survive personnel changes |

This isn't an analogy. These are isomorphisms. Which means a gitagent-standard agent operating inside a git repo doesn't just *comply with* regulated-industry controls — it *is* the control framework, by construction.

The consequence: compliance overhead drops to zero marginal cost. It's a property of the architecture, not a separate documentation layer.

---

## When This Fit Is Strongest

The structural fit is strongest when all three of the following are true in your domain:

- Work products are **recurring** (monthly, quarterly, annually) — not one-off
- The same **exception patterns** appear repeatedly across periods and can be learned from
- There is a **clear separation** between the person who does the work and the person who approves it

Domains where this applies:

| Domain | Recurring Workflow | Exception Pattern | Maker-Checker Gate |
|---|---|---|---|
| Financial close | Monthly reconciliation, variance analysis | Bank exceptions, cutoff errors, GL mismatches | Controller review of workpapers |
| Legal / contracts | Contract review, clause extraction, obligation tracking | Non-standard terms, missing clauses | Partner or GC sign-off |
| Healthcare compliance | Coding audits, claims review, prior authorizations | Upcoding flags, missing documentation, denial patterns | Medical director review |
| Insurance underwriting | Risk assessment, policy review, exposure analysis | Out-of-appetite risks, concentration flags | Senior underwriter approval |
| Regulatory reporting | Form preparation, data validation, submission review | Calculation errors, missing fields, threshold breaches | Compliance officer sign-off |

---

## Reference Implementation: GitClose

[GitClose](https://github.com/Priyanshu-Priyam/gitclose) is a working implementation of this pattern for the CFO office — specifically the monthly financial close.

Three gitagent-standard agents perform the mechanical work of a January 2025 close for Meridian Engineering Pty Ltd:

- **Atlas** (`agents/atlas-cash-recon/`) — reconciles 23 bank transactions against the GL, finds a $14,924 exception, retrieves the resolution from memory (PR #641, October 2024), and opens a PR with the reconciliation workpaper
- **Nova** (`agents/nova-ap-recon/`) — traces 47 AP invoices to GL postings by reference, catches a $5,200 ARUP-7795 cutoff error in 27 seconds, flags it with a proposed reversing JE
- **Echo** (`agents/echo-variance/`) — computes budget vs actuals for all P&L lines, generates management commentary with every explanation attributed to data or memory

Every agent action is a git commit. Every approval is a merged PR. The git history is the complete audit trail. No separate documentation. No evidence filed after the fact.

The architecture for other regulated domains is identical — only the tools and skill files change. The agent standard, git workflow, and compliance properties stay the same.

---

## Extending to a New Domain

To apply this pattern to a domain other than financial close:

1. **Define the recurring workflow** — what work is done on each cycle? What are the inputs and expected outputs?
2. **Enumerate exception types** — what deviations need to be flagged, investigated, and resolved? These become `create_exception` tool calls.
3. **Identify the maker-checker boundary** — who does the work, and who approves it? The agent is the maker; the human reviewer approves the PR.
4. **Write the skill file** — `skills/<domain>/SKILL.md` contains the step-by-step procedure, matching rules, and escalation criteria
5. **Set `RULES.md` guardrails** — what can the agent never do? (e.g. `cannot: approve_own_work`, `cannot: modify_source_data`)
6. **Seed MEMORY.md** — known patterns from prior cycles can be loaded at the start; the agent appends new patterns after each run

The git layer, agent runtime, hook system, and PR workflow require no modification. The domain-specific knowledge lives entirely in `skills/`, `SOUL.md`, `RULES.md`, and `memory/MEMORY.md`.
