---
id: task_example_003
title: Review agent safety settings
type: governance
status: blocked
priority: medium
project: Welcome
created: '2026-05-04T00:00:00.000Z'
updated: '2026-05-04T00:00:00.000Z'
position: 3000
blockedReason:
  category: waiting-on-feedback
  note: Decide which tools your agents should be allowed to use.
verificationSteps:
  - id: verify_example_003_a
    description: Confirm public deployments sit behind a reverse proxy
    checked: false
  - id: verify_example_003_b
    description: Confirm destructive actions require human review
    checked: false
---

Before giving agents meaningful access, review auth, rate limiting, tool policies, and your expectations for human approval. Start small and increase autonomy once the guardrails are familiar.
