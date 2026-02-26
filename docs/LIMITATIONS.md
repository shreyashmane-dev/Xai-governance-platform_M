# Limitations

- Current SHAP API provides global importance only; local waterfall/force APIs are not fully implemented.
- Pickle model execution assumes trusted internal upload paths; sandboxed model execution is recommended for strict zero-trust environments.
- Governance metrics assume binary-positive class behavior for some fairness calculations.
- Drift supports numeric feature PSI; categorical drift metrics are not included yet.
- Report generation is JSON snapshot-based; PDF export pipeline is not included in this starter.
