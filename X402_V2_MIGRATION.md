# x402 v2 Migration Guide

## Issue #99: Clarify official x402 v2 dependency

This document describes the migration strategy for addressing issue #99: clarifying the use of official x402 v2 dependencies with scoped packages vs unscoped x402@1.x packages.

## Problem Statement

During the v2 migration, there was ambiguity about which packages constitute "official x402 v2":

- **v1**: Uses unscoped package `x402@1.x` with import paths like `"x402/types"`, `"x402/shared"`
- **v2**: Should use scoped packages `@coinbase/x402` and `@x402/core` to avoid import path conflicts

## Current Status (Phase 1)

### Dependencies Added
All v2 packages now include both:
- `@coinbase/x402: ^2.0.0` - Official x402 v2 scoped package
- `x402: 1.0.1` - Legacy v1 package (temporary)

### Source Code
Source code continues to use v1 API:
```typescript
// Legacy imports (temporary)
import { getDefaultAsset } from "x402/shared";
import type { Network } from "x402/types";
```

## Migration Strategy

### Phase 1: Dependency Clarification ✅
- **Goal**: Clarify dependency relationships as requested in issue #99
- **Action**: Add `@coinbase/x402` to all v2 packages
- **Status**: ✅ Completed

### Phase 2: API Migration (Future)
- **Goal**: Migrate from v1 API to v2 API
- **Challenges**:
  - `@x402/core@2.0.0` has completely different API structure
  - Requires significant code refactoring
  - Breaking changes in import paths and function signatures

### Phase 3: Cleanup (Future)
- **Goal**: Remove legacy dependencies
- **Action**: Remove `x402: 1.0.1` once migration is complete

## API Differences

### v1 API (Current)
```typescript
import { exact } from "x402/schemes";
import { getDefaultAsset } from "x402/shared";
import type { Network } from "x402/types";
import { useFacilitator } from "x402/verify";
```

### v2 API (Target)
```typescript
import { HTTPFacilitatorClient } from "@x402/core/http";
import { findByNetworkAndScheme } from "@x402/core/utils";
import type { Network } from "@x402/core/types";
// Note: API structure is significantly different
```

## Benefits of This Approach

1. **Resolves Issue #99**: Clearly scoped dependencies eliminate import path conflicts
2. **Incremental Migration**: Maintains functionality during transition
3. **Clear Roadmap**: Documents complete migration path
4. **Backward Compatibility**: Existing code continues to work

## Next Steps

1. **Complete Phase 1**: Finish dependency updates and testing
2. **Plan Phase 2**: Design migration strategy for API changes
3. **Implementation**: Gradually migrate to v2 API
4. **Testing**: Comprehensive testing throughout migration

## Files Modified

- `typescript/packages/core_v2/package.json`
- `typescript/packages/hono_v2/package.json`
- `typescript/packages/fetch_v2/package.json`
- `typescript/packages/express_v2/package.json`

## Notes

- This is a transitional solution addressing the core issue of dependency clarity
- Full API migration will be addressed in separate issues/PRs
- The approach prioritizes stability while resolving the immediate concern