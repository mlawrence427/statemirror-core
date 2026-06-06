# FAQ

## Does StateMirror make decisions?

No.

The application owns the decision.

StateMirror only preserves the evidence the application submitted.

---

## What does StateMirror actually store?

StateMirror stores immutable evidence snapshots.

A snapshot usually contains the structured facts the application consulted at a decision point, such as input state, derived state, source timestamps, source versions, correlation IDs, policy versions, and the application-declared outcome.

StateMirror does not require a specific payload schema.

---

## Is StateMirror schema-agnostic?

Yes.

StateMirror Core is schema-agnostic at the core.

Your application can submit custom evidence schemas.

Optional canonical evidence shapes, such as Plan Evidence, Denial Evidence, and Expiry Evidence, may be provided as reference patterns. They are not required formats.

---

## How is this different from logs?

Logs record events that happened.

StateMirror preserves the structured state an application consulted before making a decision.

Logs are useful for debugging and operations, but they are often noisy, fragmented, and difficult to treat as a stable decision record.

StateMirror is designed to preserve a focused decision-evidence snapshot that can be retrieved later by reference.

---

## How is this different from observability?

Observability helps teams reconstruct behavior from metrics, traces, logs, and events.

StateMirror preserves decision evidence directly.

It is not a dashboard, tracing system, metrics system, alerting tool, or analytics product.

---

## Why not just use a JSONB table?

StateMirror does not replace JSONB.

It formalizes the evidence pattern teams often try to build with JSONB.

A plain JSONB table can store structured data, but StateMirror adds discipline around evidence capture:

* idempotent snapshot creation
* immutable snapshot records
* append-only correction model
* hash-chain integrity
* canonical examples
* verification path
* clear boundary between application decisions and preserved evidence

StateMirror is not valuable because it uses JSON.

It is valuable because it turns decision evidence into a disciplined, verifiable, append-only record.

---

## How is this different from OPA or policy engines?

OPA and other policy engines help applications evaluate rules.

StateMirror does not evaluate rules.

StateMirror preserves the evidence the application submitted before or around the moment it acted.

A system can use OPA to help decide and StateMirror to preserve the evidence used for that decision.

---

## How is this different from Pydantic or schema validation?

Schema validation ensures data has the expected shape.

StateMirror preserves the actual decision-state snapshot submitted by the application.

Validation can happen before a snapshot is submitted, but StateMirror's purpose is evidence preservation, not type checking.

---

## Where does the snapshot data come from?

The host application supplies the state it consulted at the decision point.

StateMirror does not query your business systems directly.

It does not fetch plan state, denial state, expiry state, account state, policy state, workflow state, or entitlement state on its own.

The application decides what evidence to submit.

---

## Does StateMirror enforce access?

No.

StateMirror does not grant access, deny access, revoke access, expire accounts, execute workflows, trigger webhooks, send notifications, or enforce policy.

Your application owns enforcement.

StateMirror preserves evidence.

---

## What happens if upstream state is stale?

StateMirror records what the application actually observed and submitted.

It does not rewrite history to match later truth.

If the application acted on stale but real data, StateMirror should preserve that fact clearly.

A good snapshot should include source timestamps, source versions, read times, correlation IDs, or other provenance fields when available.

---

## What if upstream systems disagree?

StateMirror can preserve the disagreement if the application submits it.

For example, a snapshot might show that billing reported an active subscription while an entitlement service reported a denied feature.

StateMirror does not reconcile conflicting systems.

It preserves the evidence the application had when it acted.

---

## Does StateMirror prove a decision was correct?

No.

StateMirror preserves what the application knew at the time.

Correctness remains the responsibility of the application, business logic, policy logic, and upstream systems.

StateMirror can help explain why an application acted, but it does not prove the action was right.

---

## Does StateMirror provide compliance guarantees?

No.

StateMirror provides tamper-evident evidence preservation.

It does not provide legal non-repudiation, regulatory compliance, Byzantine fault tolerance, legal audit certification, or security guarantees by itself.

Teams may use StateMirror as part of a broader compliance or audit process, but StateMirror alone is not a compliance product.

---

## Can I store custom evidence types?

Yes.

Custom evidence schemas are first-class.

StateMirror Core stores submitted JSON evidence without forcing your domain into a fixed schema.

Canonical examples are optional reference patterns, not required formats.

---

## Are Plan Evidence, Denial Evidence, and Expiry Evidence required?

No.

They are optional canonical evidence shapes.

They may be useful for common application decision patterns, but they are not required by StateMirror Core.

StateMirror should not become limited to SaaS entitlements.

Custom evidence schemas remain allowed.

---

## Can StateMirror run workflows or trigger follow-up actions?

No.

StateMirror does not run workflows.

It does not trigger webhooks, send notifications, retry jobs, execute remediations, or call downstream systems.

The application or workflow system owns execution.

StateMirror preserves evidence.

---

## Can I update a snapshot?

No.

Snapshots are intended to be immutable.

If new information is discovered later, create a new corrective or follow-up snapshot rather than mutating the original record.

The original snapshot should continue to show what the application submitted at the time.

---

## What is the correction model?

StateMirror favors append-only correction.

If the original evidence was incomplete, stale, or later found to be wrong, the correction should be represented as a new snapshot that references the earlier one.

This keeps the historical record intact while allowing later context to be preserved.

---

## What does hash-chain verification prove?

Hash-chain verification helps detect whether stored snapshot payloads or ordering have changed after capture.

Each snapshot contributes to a chain using its payload hash, previous chain hash, and sequence number.

If a historical payload is modified, verification should fail.

Hash-chain verification provides tamper evidence. It does not prove the original application decision was correct.

---

## Is StateMirror an observability product?

No.

StateMirror is not trying to replace logs, metrics, traces, dashboards, alerts, or analytics tools.

It complements those tools by preserving focused decision evidence.

---

## Who is StateMirror for?

StateMirror is for teams that need to answer:

> What did the application know when it made this decision?

It is especially relevant when decisions involve changing upstream state, business rules, entitlements, approvals, expirations, denials, disputes, support reviews, or operational investigations.

---

## What is the simplest mental model?

Applications decide.

StateMirror preserves evidence.
