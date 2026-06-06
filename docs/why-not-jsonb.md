# Why Not Just a JSONB Table?

This is one of the most common questions about StateMirror.

The short answer is:

> StateMirror does not replace JSONB. It formalizes the evidence pattern teams often try to build with JSONB.

A JSONB column is a storage mechanism.

StateMirror is an evidence-preservation model.

---

# The honest answer

You can absolutely build an evidence system with PostgreSQL and JSONB.

Many teams do.

In fact, StateMirror itself stores structured JSON data.

The question is not:

> Can JSONB store evidence?

The answer is obviously yes.

The real question is:

> What discipline exists around that evidence?

That is where StateMirror differs.

---

# What teams often start with

Many systems begin with a table that looks something like:

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

That is often enough for the first version of a system.

The application inserts JSON.

The database stores it.

Later, support or engineering can retrieve it.

There is nothing inherently wrong with this approach.

---

# What usually happens over time

As systems grow, teams often start adding requirements:

* prevent accidental duplicate writes
* preserve historical evidence
* detect modification
* explain decisions consistently
* support investigations
* support disputes
* support audits
* support operational reviews
* provide stable retrieval patterns

The simple JSONB table gradually becomes more than a JSONB table.

The team starts building evidence infrastructure around it.

---

# The evidence pattern

A common evolution looks like:

```txt
JSONB storage
↓
Idempotency
↓
Evidence references
↓
Snapshot retrieval
↓
Immutable history
↓
Integrity verification
↓
Operational conventions
↓
Evidence discipline
```

StateMirror attempts to formalize that pattern.

---

# Idempotency

A plain JSONB table does not automatically provide idempotent snapshot creation.

Consider:

```txt
Request sent
↓
Network timeout
↓
Client retries
```

Without idempotency, duplicate records may be created.

StateMirror treats idempotent snapshot creation as a first-class concern.

Expected behavior:

```txt
same key + same payload
→ original response

same key + different payload
→ conflict
```

This creates more predictable evidence records.

---

# Immutable evidence

Many JSONB implementations begin as append-only systems.

Over time, someone adds updates.

Example:

```sql
UPDATE decisions
SET payload = ...
WHERE id = ...;
```

Now the historical record has changed.

Sometimes intentionally.

Sometimes accidentally.

StateMirror favors immutable evidence preservation.

If new information arrives later, create a new snapshot rather than modifying the old one.

---

# Append-only correction

StateMirror treats corrections as new evidence.

Example:

```txt
Original snapshot
↓
Later discovery
↓
Corrective snapshot
```

Instead of rewriting history:

```txt
Original snapshot
↓
Modify original record
```

The historical record remains visible.

This is often more useful during investigations.

---

# Integrity verification

A JSONB table stores JSON.

It does not automatically provide integrity verification.

StateMirror snapshots include:

```txt
payload_hash
prev_chain_hash
chain_hash
sequence_num
```

Conceptually:

```txt
payload_hash = hash(payload)

chain_hash = hash(
  sequence_num,
  payload_hash,
  prev_chain_hash
)
```

This creates a tamper-evident chain.

If historical evidence changes, verification should fail.

---

# Evidence references

Many JSONB implementations eventually invent a retrieval model.

Examples:

```txt
request_id
correlation_id
decision_id
case_id
```

StateMirror treats evidence references as a first-class concept.

This makes it easier to retrieve evidence related to a decision or investigation.

---

# Evidence discipline

The most important difference is not technical.

It is conceptual.

A JSONB table stores JSON.

StateMirror stores decision evidence.

That distinction sounds small but becomes important over time.

StateMirror encourages snapshots that clearly separate:

```txt
inputs
derived facts
decision evidence
outcome
provenance
timestamps
references
```

The goal is to preserve the context surrounding a decision.

---

# What StateMirror does not claim

StateMirror does not claim that JSONB is bad.

StateMirror does not claim that teams must adopt StateMirror.

StateMirror does not claim that evidence preservation requires a dedicated product.

A well-designed JSONB implementation can solve many of the same problems.

StateMirror simply packages the evidence pattern into a focused runtime with explicit boundaries.

---

# Why not just store logs?

Logs answer:

```txt
What happened?
```

StateMirror answers:

```txt
What did the application know when it decided?
```

Those are related questions, but they are not identical.

Logs often reconstruct a story.

StateMirror attempts to preserve the evidence directly.

---

# Why not just use observability?

Observability helps reconstruct system behavior from:

* logs
* metrics
* traces
* events

StateMirror preserves a focused decision-evidence snapshot.

Observability explains behavior.

StateMirror preserves evidence.

They complement each other.

---

# Why not just use a policy engine?

Policy engines help evaluate rules.

Examples include:

```txt
authorization rules
business rules
governance rules
```

StateMirror does not evaluate rules.

StateMirror preserves the evidence surrounding a decision.

A system can use both.

---

# What StateMirror actually provides

StateMirror attempts to provide:

* immutable evidence snapshots
* idempotent creation
* evidence references
* append-only correction
* hash-chain verification
* schema-agnostic evidence storage
* retrieval by reference
* clear evidence boundaries

The goal is not to replace PostgreSQL.

The goal is not to replace JSONB.

The goal is not to replace application logic.

The goal is to make decision evidence a first-class concept.

---

# The simplest summary

StateMirror does not replace JSONB.

It formalizes the evidence pattern teams often try to build with JSONB.

StateMirror is not valuable because it uses JSON.

It is valuable because it turns decision evidence into a disciplined, verifiable, append-only record.
