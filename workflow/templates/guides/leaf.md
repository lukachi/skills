
## Leaf repository practice

The curated project knowledge for this repository is at
`{{KNOWLEDGE_PATH}}`.

At the start of significant work, ask the agent to show the framing review
packet after Graphify analysis and knowledge alignment. During implementation,
review only material deviations or new decisions. At the end, ask for the
completion review packet before accepting the completed outcome.

Typical commands used by the agent:

```sh
wfctl work begin <slug> \
  --title "<outcome>" \
  --mode full \
  --knowledge-ref knowledge/<relevant-concept>.md \
  --graph-query "<relationship question>"

wfctl work verify <work-id>
wfctl work flush <work-id> --outcome completed
```

The canonical spec remains in the knowledge repository under
`changes/active/`. This leaf contains only a pointer under `.workflow/current/`;
do not create a competing local spec.
