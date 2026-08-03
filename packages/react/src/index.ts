// ─── Context + Provider ───────────────────────────────────────────────────────
export { VeilProvider, useVeilContext } from './context/VeilProvider';
export type { VeilProviderProps } from './context/VeilProvider';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useIdentity } from './hooks/useIdentity';
export type { UseIdentityReturn, IdentityStatus } from './hooks/useIdentity';

export { useReputation } from './hooks/useReputation';
export type { UseReputationReturn, ProofStatus } from './hooks/useReputation';

export { useReputationCheck } from './hooks/useReputationCheck';
export type { UseReputationCheckOptions, UseReputationCheckReturn } from './hooks/useReputationCheck';

// ─── Components ───────────────────────────────────────────────────────────────
export { VeilRegister } from './components/VeilRegister';
export type { VeilRegisterProps } from './components/VeilRegister';

export { VeilBadge } from './components/VeilBadge';
export type { VeilBadgeProps } from './components/VeilBadge';

export { VeilGate } from './components/VeilGate';
export type { VeilGateProps } from './components/VeilGate';
