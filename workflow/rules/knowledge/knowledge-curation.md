# Knowledge authority

The knowledge repository has three distinct surfaces:

- `raw/`: immutable evidence, not current truth.
- `changes/`: active and archived work records.
- `knowledge/`: curated OKF v0.2 concepts representing the current knowledge surface.

Never promote raw text by copying it verbatim into current knowledge. Reconcile it against code, later records, linked sources, existing decisions, and maintainer testimony.

When sources conflict and evidence cannot resolve them, keep the concept draft, record the uncertainty, and ask the maintainer. Do not invent chronology or select a preferred account silently.

Do not equate lifecycle with trust. `status: stable` means ready for consumption;
it does not mean human-reviewed. Record `verified` by a `human:<id>` only after
that person explicitly reviews the current material claims through the protocol
in `PROJECT_WORKFLOW.md`.

When a decision changes, create or update the successor, link it to the superseded decision, and deprecate the old concept without deleting its history. Update relevant index and log files.
