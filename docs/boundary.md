# StateMirror Boundary

This document defines what StateMirror Core is responsible for and what it is intentionally not responsible for.

The goal is to keep the boundary stable, explicit, and easy to reason about.

---

# Core principle

StateMirror preserves evidence.

Applications make decisions.

Applications execute outcomes.

StateMirror records what the application submitted at a decision point and makes that evidence retrievable later.

---

# What StateMirror does

StateMirror Core:

* accepts evidence snapshots
* stores evidence immutably
* assigns references to snapshots
* supports idempotent snapshot creation
* preserves evidence history
* supports hash-chain verification
* allows retrieval of preserved evidence
* remains schema-agnostic at the core

StateMirror exists to answer a simple question:

> What did the application know when it made this decision?

---

# What StateMirror does not do

StateMirror does not:

* authorize users
* authenticate users
* enforce policy
* evaluate business rules
* evaluate permissions
* grant access
* deny access
* revoke access
* expire accounts
* execute workflows
* trigger webhooks
* send notifications
* schedule jobs
* perform remediation
* reconcile upstream systems
* manage subscriptions
* manage entitlements
* replace observability systems
* replace workflow engines
* replace policy engines
* replace application business logic

Those responsibilities belong to the application or surrounding infrastructure.

---

# Application ownership

The application owns:

* data collection
* business logic
* policy evaluation
* entitlement checks
* workflow execution
* authorization decisions
* outcome execution
* side effects

StateMirror owns:

* evidence preservation

Nothing more.

---

# Decision ownership

Applications decide.

StateMirror does not.

A typical flow looks like:

```txt
Application gathers facts
↓
Application evaluates rules
↓
Application reaches decision
↓
Application submits evidence snapshot
↓
StateMirror preserves evidence
↓
Application executes outcome
```

The decision belongs to the application.

The evidence belongs to StateMirror.

---

# Evidence ownership

StateMirror does not independently determine truth.

It preserves what the application submitted.

For example:

```txt
Billing service says subscription is active
Entitlement service says access is denied
```

The application may choose how to interpret that conflict.

StateMirror preserves the evidence that was submitted.

StateMirror does not resolve the disagreement.

---

# Stale data

StateMirror records what the application observed.

It does not rewrite history later.

For example:

```txt
10:00:00
Application reads active subscription

10:00:01
Application grants access

10:00:05
Subscription is canceled
```

The later cancellation does not change the evidence snapshot.

The snapshot should continue to show what the application actually observed at the time.

---

# Correctness

StateMirror does not prove a decision was correct.

StateMirror preserves:

```txt
What the application knew
```

StateMirror does not prove:

```txt
What the application should have known
```

Correctness remains the responsibility of:

* application code
* policy logic
* business rules
* upstream systems
* operational processes

---

# Schema model

StateMirror Core is schema-agnostic.

Applications may submit any evidence schema that fits their domain.

Examples:

* subscription decisions
* entitlement decisions
* approval workflows
* moderation reviews
* operational actions
* compliance reviews
* internal tooling decisions

No specific evidence schema is required.

---

# Canonical evidence shapes

StateMirror may provide optional canonical evidence shapes for common patterns.

Examples include:

* Plan Evidence
* Denial Evidence
* Expiry Evidence

These are reference schemas only.

They are not required formats.

Applications remain free to use custom evidence schemas.

---

# Plan Evidence boundary

Plan Evidence may describe facts such as:

```txt
plan = commercial
status = active
entitlements = [...]
```

Plan Evidence does not:

```txt
grant access
upgrade users
change subscriptions
enforce plans
```

It only preserves evidence.

---

# Denial Evidence boundary

Denial Evidence may describe facts such as:

```txt
denial present
denial absent
reason code
scope
```

Denial Evidence does not:

```txt
block requests
deny access
enforce policy
```

It only preserves evidence.

---

# Expiry Evidence boundary

Expiry Evidence may describe facts such as:

```txt
expires_at
expired
not_expired
renewable
```

Expiry Evidence does not:

```txt
expire accounts
disable users
execute cleanup
```

It only preserves evidence.

---

# Why StateMirror is schema-agnostic

Different systems make different kinds of decisions.

A subscription platform may preserve entitlement evidence.

A workflow platform may preserve approval evidence.

An operations platform may preserve operational evidence.

A compliance platform may preserve review evidence.

StateMirror should not force all of these domains into a single schema.

The core runtime preserves evidence regardless of domain.

---

# Observability boundary

StateMirror is not an observability platform.

StateMirror does not attempt to replace:

* logs
* metrics
* traces
* dashboards
* alerting systems

Observability tools help reconstruct behavior.

StateMirror preserves a focused decision-evidence record.

These systems can complement each other.

---

# Policy engine boundary

StateMirror is not a policy engine.

StateMirror does not evaluate:

* authorization rules
* business rules
* compliance rules
* governance rules

Tools such as policy engines may help applications decide.

StateMirror preserves the evidence surrounding the decision.

---

# Workflow boundary

StateMirror is not a workflow engine.

StateMirror does not:

* execute approvals
* route tasks
* manage state transitions
* orchestrate systems

Workflow systems execute processes.

StateMirror preserves evidence.

---

# Integrity boundary

Hash-chain verification provides tamper evidence.

It helps detect whether preserved snapshots or ordering have changed after capture.

Hash-chain verification does not provide:

* legal non-repudiation
* compliance certification
* Byzantine fault tolerance
* distributed consensus
* proof that a decision was correct

It only helps demonstrate preservation integrity.

---

# Simplest mental model

Applications decide.

StateMirror preserves evidence.
