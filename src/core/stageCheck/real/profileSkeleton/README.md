# Stage Check Real Profiles — Skeleton

This folder is a non-runtime skeleton for future universalization of the real stage-check system.

## Goal

Move from stage-number / ad-hoc heuristics toward a universal model based on:

- workflow node profile
- evidence profile
- exact evaluation profile
- aggregate evaluation profile

The skeleton is intentionally NOT connected to runtime yet.

## Why

Workflow is mutable:
- stages can be renamed
- subtree structure can change
- new stages can be added
- old stages can be removed or split

Because of that, runtime logic must not depend on stage numbers or exact fixed titles.

## Target architecture

1. Workflow subtree
2. Semantic resolver
3. Node profile
4. Evidence contract
5. Exact evaluator contract
6. Aggregate evaluator contract

## Planned families

- foundation
- feature
- integration
- policy
- output
- generic

## Important rule

Do not connect this skeleton to runtime until:
1. contracts are finalized
2. profile resolution rules are reviewed
3. test scenarios are prepared
4. migration plan from current runtime rules is approved