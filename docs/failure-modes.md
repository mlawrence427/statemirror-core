# Failure Modes

StateMirror preserves decision evidence.

It does not guarantee that the application made the correct decision, observed complete truth, or acted on fresh data.

This document describes important failure modes and how StateMirror should represent them.

---

## Core principle

StateMirror should preserve what the application actually knew.

Not what the application should have known.

Not what later became true.

Not what upstream systems eventually agreed on.

The record should remain faithful to the evidence submitted at the decision moment.

---

## 1. Stale upstream data

### Situation

The application reads data from an upstream system, but the data is already stale.

Example:

```txt
10:00:00  Application reads subscription = active
10:00:01  Application grants premium access
10:00:05  Billing system records subscription = canceled
```

### What StateMirror should preserve

The snapshot should show that the application observed an active subscription at the time it acted.

Recommended fields:

```json
{
  "inputs": {
    "subscription": {
      "status": "active",
      "source": "billing-service",
      "read_at": "2025-12-01T10:00:00.000Z",
      "source_updated_at": "2025-12-01T09:59:50.000Z"
    }
  },
  "computed": {
    "decision": "granted"
  }
}
```

### Boundary

StateMirror does not correct stale reads.

It preserves the stale read as evidence.

---

## 2. Missing provenance

### Situation

The application submits evidence without source timestamps, versions, or read times.

Example:

```json
{
  "state_payload": {
    "subscription": {
      "status": "active"
    },
    "computed": {
      "decision": "granted"
    }
  }
}
```

### Risk

The snapshot may preserve the decision evidence, but later reviewers may not know:

* where the fact came from
* when it was read
* which version of the source produced it
* whether it was fresh or stale

### Recommended approach

Include provenance when available:

```json
{
  "subscription": {
    "status": "active",
    "source": "billing-service",
    "source_version": "2025-12-01",
    "read_at": "2025-12-01T10:00:00.000Z",
    "source_updated_at": "2025-12-01T09:59:50.000Z"
  }
}
```

### Boundary

StateMirror can preserve provenance only if the application submits it.

StateMirror does not discover missing provenance on its own.

---

## 3. Conflicting upstream systems

### Situation

Two upstream systems disagree.

Example:

```txt
Billing service: subscription = active
Entitlement service: premium_api = denied
```

### What StateMirror should preserve

The snapshot should preserve both facts if the application consulted both.

```json
{
  "inputs": {
    "billing": {
      "subscription_status": "active",
      "read_at": "2025-12-01T10:00:00.000Z"
    },
    "entitlements": {
      "premium_api": "denied",
      "reason": "manual_override",
      "read_at": "2025-12-01T10:00:00.100Z"
    }
  },
  "computed": {
    "decision": "denied",
    "reason": "manual_override_takes_precedence"
  }
}
```

### Boundary

StateMirror does not reconcile conflicting systems.

The application decides how to handle disagreement.

StateMirror preserves the disagreement as evidence.

---

## 4. Incomplete evidence

### Situation

The application makes a decision but submits only part of the evidence.

Example:

```json
{
  "state_payload": {
    "computed": {
      "decision": "denied"
    }
  }
}
```

### Risk

Later reviewers can see the result, but not the facts that led to it.

### Recommended approach

Include enough evidence to explain the decision:

```json
{
  "state_payload": {
    "subject": "user_123",
    "requested_resource": "premium_api",
    "inputs": {
      "plan": {
        "status": "free"
      },
      "denial": {
        "signal": "denial_absent"
      },
      "expiry": {
        "signal": "not_expired"
      }
    },
    "computed": {
      "eligible": false,
      "decision": "denied",
      "reason": "plan_does_not_include_resource"
    }
  }
}
```

### Boundary

StateMirror preserves what is submitted.

It does not know whether the application omitted important evidence.

---

## 5. Incorrect application logic

### Situation

The application observes correct evidence but makes the wrong decision.

Example:

```json
{
  "state_payload": {
    "inputs": {
      "plan": {
        "status": "free",
        "entitlements": []
      }
    },
    "computed": {
      "eligible": true,
      "decision": "granted"
    }
  }
}
```

### What StateMirror should preserve

StateMirror should preserve the incorrect decision evidence exactly as submitted.

### Boundary

StateMirror does not prove correctness.

It helps reviewers see that the application had evidence that appears inconsistent with the decision.

---

## 6. Late-arriving facts

### Situation

New facts arrive after the decision.

Example:

```txt
10:00:00  Application denies access
10:00:03  Payment confirmation arrives
10:00:04  Account becomes active
```

### What StateMirror should preserve

The original snapshot should remain unchanged.

If needed, create a follow-up snapshot:

```json
{
  "evidence_ref": "premium-api:user_123:req_001:correction_001",
  "evidence_type": "decision_evidence_correction",
  "state_payload": {
    "corrects_or_extends": "premium-api:user_123:req_001",
    "new_fact": {
      "payment_status": "confirmed",
      "arrived_at": "2025-12-01T10:00:03.000Z"
    },
    "note": "Payment confirmation arrived after the original decision."
  }
}
```

### Boundary

StateMirror favors append-only correction.

Do not mutate historical snapshots to match later truth.

---

## 7. Duplicate client retries

### Situation

A client submits the same snapshot multiple times because of a timeout or retry.

### Expected behavior

The same idempotency key with the same payload should return the original snapshot response.

```txt
same key + same payload      → original snapshot response
same key + different payload → conflict
```

### Boundary

Idempotency protects against accidental duplicate snapshot creation.

It does not decide whether the evidence itself is correct.

---

## 8. Idempotency conflict

### Situation

A client reuses the same idempotency key with a different payload.

Example:

```txt
Request 1:
Idempotency-Key: decision-123
payload_hash: abc

Request 2:
Idempotency-Key: decision-123
payload_hash: xyz
```

### Expected behavior

StateMirror should reject the second request as a conflict.

### Recommended approach

Use stable idempotency keys only for retrying the exact same request.

Use a new idempotency key for a new snapshot.

### Boundary

StateMirror detects the conflicting retry.

The application must decide whether the second payload represents a new decision, correction, or client bug.

---

## 9. Tampered historical payload

### Situation

A stored historical payload is modified outside the normal append-only flow.

### Expected behavior

Hash-chain verification should fail.

### What verification helps detect

* changed payload content
* changed payload ordering
* broken chain continuity

### Boundary

Verification provides tamper evidence.

It does not provide legal non-repudiation, distributed consensus, or proof that the original decision was correct.

---

## 10. Out-of-band side effects

### Situation

The application submits evidence to StateMirror, then executes an outcome outside StateMirror.

Example:

```txt
Application snapshots evidence
Application grants access
Application sends email
Application updates account status
```

### What StateMirror should preserve

The snapshot may include an application-declared outcome:

```json
{
  "outcome": {
    "owned_by": "application",
    "action": "grant_premium_api_access",
    "executed_outside_statemirror": true
  }
}
```

### Boundary

StateMirror does not execute or verify side effects.

It preserves the evidence and any submitted outcome declaration.

---

## 11. Snapshot created after action

### Situation

The application executes the outcome before submitting the evidence snapshot.

Example:

```txt
10:00:00  Application grants access
10:00:01  Application submits StateMirror snapshot
```

### Risk

The snapshot still preserves useful evidence, but it may not strictly prove that the evidence was captured before the action.

### Recommended approach

Prefer this order:

```txt
Application computes facts
↓
Application submits evidence snapshot
↓
Application executes outcome
```

Include timestamps when available:

```json
{
  "captured_at": "2025-12-01T10:00:00.900Z",
  "outcome": {
    "action": "grant_access",
    "executed_at": "2025-12-01T10:00:01.000Z",
    "owned_by": "application"
  }
}
```

### Boundary

StateMirror can preserve timing evidence.

It cannot prove ordering that the application did not submit or enforce.

---

## 12. Sensitive data overcapture

### Situation

The application submits more data than necessary.

Examples:

* personal data
* secrets
* API keys
* tokens
* private notes
* unrelated account data

### Recommended approach

Submit the minimum evidence needed to explain the decision.

Avoid submitting secrets, credentials, tokens, full payment details, or unrelated personal data.

### Boundary

StateMirror preserves what it receives.

Applications are responsible for redaction, minimization, and compliance handling before submission.

---

## 13. Misusing StateMirror as enforcement

### Situation

A team starts treating StateMirror as the system that decides access or policy.

### Incorrect model

```txt
StateMirror decides whether access is allowed
```

### Correct model

```txt
Application decides whether access is allowed
StateMirror preserves the evidence
```

### Boundary

StateMirror is not an authorization system, entitlement service, policy engine, workflow engine, or enforcement layer.

---

## 14. Misusing StateMirror as observability

### Situation

A team expects StateMirror to replace logs, metrics, traces, dashboards, or alerts.

### Boundary

StateMirror is not an observability product.

It preserves focused decision evidence.

Observability tools help reconstruct system behavior.

StateMirror preserves the evidence the application submitted for a decision.

---

## 15. Missing snapshot

### Situation

A reviewer requests a snapshot ID that does not exist.

Example:

```bash
curl http://localhost:8080/v1/snapshots/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer smr_test_read_key_123"
```

### Expected behavior

The API returns `404 Not Found`.

Snapshot verification may include:

```json
{
  "error": "Not Found",
  "message": "Snapshot not found",
  "failure_code": "SNAPSHOT_NOT_FOUND"
}
```

### Boundary

A missing snapshot means StateMirror cannot retrieve or verify that reference.

It does not prove whether the application did or did not make a decision.

---

## 16. Malformed stored snapshot

### Situation

A stored record cannot be verified because required persisted fields are missing or malformed.

### Expected behavior

Verification should fail with `MALFORMED_SNAPSHOT` where applicable.

### Boundary

Malformed snapshot detection is about preservation integrity.

It does not validate application payload meaning or policy correctness.

---

## 17. Invalid verification range

### Situation

A caller requests an invalid sequence range.

Example:

```json
{
  "from_sequence": 10,
  "to_sequence": 5
}
```

### Expected behavior

`POST /v1/integrity/verify` returns `400 Bad Request` with `VERIFY_RANGE_INVALID`.

### Boundary

Invalid range errors are request-shape errors.

They do not indicate that preserved evidence was tampered with.

---

## 18. Invalid query window

### Situation

A caller queries by `evidence_type` without a valid bounded capture window.

Examples:

```txt
missing captured_after
missing captured_before
window longer than 24 hours
captured_after later than captured_before
invalid timestamp
```

### Expected behavior

`GET /v1/snapshots` returns `400 Bad Request`.

### Boundary

The query endpoint is retrieval-oriented.

It is not an analytics interface over arbitrary payload meaning.

---

## 19. Auth failure

### Situation

A request omits a bearer token or uses the wrong key for the endpoint.

Examples:

```txt
read endpoint called without READ_API_KEYS token
write endpoint called without WRITE_API_KEYS token
```

### Expected behavior

The API returns `401 Unauthorized`.

### Boundary

StateMirror API keys protect service endpoints.

They are not end-user authentication, authorization, or policy enforcement.

---

## 20. Idempotency conflict

### Situation

A client reuses an `Idempotency-Key` with a different payload.

Example:

```txt
same key + payload A
same key + payload B
```

### Expected behavior

`POST /v1/snapshots` returns `409 Conflict`.

### Boundary

The conflict protects evidence creation from ambiguous retries.

The application must decide whether the second payload is a new decision, a correction, or a client bug.

---

## 21. Broad evidence_ref query

### Situation

A caller queries an `evidence_ref` that matches too many snapshots.

### Expected behavior

If more than 100 snapshots match, `GET /v1/snapshots?evidence_ref=...` returns `400 Bad Request` asking for a more specific reference.

### Boundary

StateMirror retrieval is reference-driven.

It is not a general-purpose analytics or search system.

---

## Summary

StateMirror should make failure modes easier to inspect, not disappear.

It preserves:

```txt
what the application submitted
```

It does not guarantee:

```txt
what was globally true
what should have happened
whether the decision was correct
whether upstream systems agreed
whether side effects executed correctly
```

Applications decide.

StateMirror preserves evidence.
