# StateMirror Core Project Rules

StateMirror preserves decision evidence: what an application knew when it acted.

StateMirror must not become a workflow engine, policy engine, rules engine, feature flag system, observability platform, hosted service, or enforcement layer.

State is queried. Decisions are made. Actions remain application-owned.

Native Evidence Lanes are optional canonical evidence shapes only.

Evidence Lanes must not become required formats.

StateMirror Core must remain schema-agnostic at the snapshot layer.

Do not change migrations, route handlers, storage, hashing, auth, query behavior, or server behavior unless explicitly requested.

Prefer small reviewable diffs.

Add examples and docs before abstractions.

Preserve existing public behavior.

If a change expands scope, stop and explain why.
