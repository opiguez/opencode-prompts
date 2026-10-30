---
description: Bundle audit (tree shaking, code splitting, dependencies, assets)
agent: bundle-auditor
subagent: true
---

Audit the build for bundle size and delivery inefficiencies.

Target (module, feature or whole app): $ARGUMENTS

Produce a production build with the project's analyzer before reporting.
If no analyzer is installed, say so and downgrade size claims to `hypothesis`.
