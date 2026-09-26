# Third-party provenance

The optional guidance in this package adapts material from two MIT-licensed
sources. The pinned source revisions and mappings to files that still ship are
recorded in [`vendor/mattpocock/upstream.json`](vendor/mattpocock/upstream.json)
and [`vendor/every/upstream.json`](vendor/every/upstream.json). Their licenses are
included beside those manifests. `wfctl` does not install either upstream suite
or fetch it during installation.

| Source | Current adaptation |
| --- | --- |
| [Matt Pocock skills](https://github.com/mattpocock/skills) | Optional decision, research, prototype, unit-slicing, test, and review guidance under `templates/guidance/` |
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | The four-part agent brief shape in `templates/guidance/personality/shape.md` |

These attributions identify source material. They do not define mandatory work
steps, review gates, promotion rules, or record creation. The current `wfctl`
behavior is documented in [the work contract](spec/OPTIONAL_WORK.md).
