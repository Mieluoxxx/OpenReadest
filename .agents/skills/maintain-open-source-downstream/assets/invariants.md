# **PROJECT_NAME** Downstream Invariants

These durable contracts must survive feature work and upstream intake. Keep
run-specific analysis and evidence in the owning Trellis task.

## Repository Model

| Area               | Invariant | Evidence or owner                      | Update risk |
| ------------------ | --------- | -------------------------------------- | ----------- |
| upstream identity  | TODO      | license and upstream source            | T3          |
| branch strategy    | TODO      | `.trellis/sync-upstream/contract.yaml` | T3          |
| immutable baseline | TODO      | Git and release source                 | T2          |

## Product Behavior

| Area | Invariant | Evidence or owner                 | Update risk |
| ---- | --------- | --------------------------------- | ----------- |
| TODO | TODO      | work item, tests, or owning patch | T0-T3       |

## Data And Compatibility

| Area           | Invariant                                        | Evidence or owner             | Update risk |
| -------------- | ------------------------------------------------ | ----------------------------- | ----------- |
| released state | TODO: identify what users have actually received | delivery or operations source | T3          |
| migration      | TODO                                             | tests and runbook             | T3          |

## Validation And Modules

| Area                | Invariant | Evidence or owner                      | Update risk |
| ------------------- | --------- | -------------------------------------- | ----------- |
| independent modules | TODO      | `.trellis/sync-upstream/validation.md` | T2          |
| supported matrix    | TODO      | CI and project documentation           | T2-T3       |

## Delivery And Operations

| Area                | Invariant              | Evidence or owner                           | Update risk |
| ------------------- | ---------------------- | ------------------------------------------- | ----------- |
| artifact identity   | TODO                   | contract delivery fields and release source | T3          |
| deployment boundary | TODO or not applicable | operations source                           | T3          |
| rollback            | TODO                   | operations source                           | T3          |

## License And Attribution

| Area                | Invariant     | Evidence or owner        | Update risk |
| ------------------- | ------------- | ------------------------ | ----------- |
| notices             | Preserve TODO | license and NOTICE files | T3          |
| source availability | TODO          | delivery workflow        | T3          |
