---
description: Runtime performance audit (re-renders, async races, data structures, leaks)
agent: perf-auditor
subagent: true
---

Audit the target below for runtime performance bottlenecks.

Target (file, directory, feature or component): $ARGUMENTS

If the target is empty, audit the modules changed in the working tree.
Measure before reporting: use the profiler, Lighthouse or existing instrumentation;
label anything unmeasured as `hypothesis`.
