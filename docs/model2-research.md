# Model 2 research screens

The frontend consumes REST 0.1.3 and WebSocket 1.3.0, pinned under `contracts/`.
The realtime manager reads that pinned version rather than a separate hardcoded
copy. Backend execution descriptors select the four-leg workflow; all trading
decisions, cycle eligibility, monetary totals and assessments stay on the server.

In Library, select Model 2, inspect its documented rules and save an immutable
configuration. The editor preserves numeric enum values and strict booleans and
requires validation again after a parameter change. The primary template has
200-point wings, 2% slippage and the experimental VIX filter off. Native bundles
show their calendar, components and source availability in the dataset explorer;
they are not opened as a single legacy CSV.

In Studio, select the algorithm, saved version, bundle, range and research
capital. Review cycle readiness, acknowledge pricing/data limitations and, when
partial, the exact coverage. Changing inputs invalidates the review. Starting
performs a final server review and creates one idempotent group of three replays.

`/studio?researchGroup=<id>` restores the group. Existing saved run URLs route
to their group without calling the legacy two-leg trade endpoint. Scenario and
cycle selections are URL-backed. Each scenario shows its own progress, effective
scope and data reliability. Cycle inspection includes all four typed legs,
original triggers, actual fill prices, charges, flags and saved source evidence.
The chronological timeline uses `/portfolio-journal` and can inspect earlier
worker attempts after recovery without passing pending states to the legacy
three-state journal schema.

Priced returns and assumed risk amounts appear in separate sections. Unknown
outcomes display "Unknown". The same-cycle comparison retains skipped and
unvisited-after-halt states. History shows the primary child per request and
links to all scenarios; generic two-run comparison is disabled for this mode.
The dashboard uses a selected completed result and does not sum repeated runs
or counterfactual scenarios. ZIP/Excel downloads include every scenario separately.

Three child subscriptions share the existing single socket. Refreshes are
coalesced; active views also poll durable REST records every two seconds and
recover on focus/reconnect. Dialogs use the existing accessible Radix controls,
and wide tables scroll within their containers. The cycle dialog uses an opaque
surface, wraps its text within a phone viewport, scrolls within 90% of viewport
height and restores focus to its opener. The four-leg prices region is separately
scrollable and keyboard focusable. Download blobs remain available while the
view is open, with at most one retained URL per export button; replacing a file
or leaving the view releases it so browser Save dialogs have time to consume it.

Automated tests cover acknowledgements, stale reviews, final server refusal,
four-leg inspection, missing P&L, risk separation, scenario switching, recovery,
native bundle evidence and typed Library saves. Existing journeys, format/lint,
type checks, contract checks and the production build must pass together.

Native Vivaldi verified local login, readiness/creation, all four desktop legs,
Escape/focus return, phone dialog text wrapping, three scenarios and saved-group
recovery after local service restarts. Excel and ZIP downloads match the stored
artifacts exactly; ZIP used the browser's Save As flow after its default Save
did not produce a file. The final updated timeline and phone horizontal-scroll
recheck still require an unlocked Mac. The timeline HTTP and automated checks
pass. See the workspace's `docs/audits/2026-11-19-model-2-final-checks/README.md`.
