# FAQ

## How is this different from logs?

Logs record events that happened.

StateMirror preserves the structured state an application consulted before making a decision.

## How is this different from observability?

Observability helps reconstruct behavior.

StateMirror preserves decision evidence directly.

## How is this different from Pydantic/schema validation?

Schema validation ensures data shape.

StateMirror preserves the actual decision-state snapshot used by the application.

## Does StateMirror make decisions?

No.

The application owns the decision.

StateMirror only records evidence.

## Where does the snapshot data come from?

The host application supplies the state it consulted at the decision point.

## What happens if upstream state is stale?

StateMirror records what the application actually observed.

It does not rewrite history to match later truth.

## Does StateMirror prove a decision was correct?

No.

StateMirror preserves what the application knew at the time.

Correctness remains the responsibility of the application and business logic.