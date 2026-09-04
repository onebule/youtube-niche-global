import { createDefaultProviders } from './providers.ts';
import type { VideoComputeProvider } from './types.ts';

export class ProviderRegistry {
  private readonly providers = new Map<string, VideoComputeProvider>();

  constructor(initial: VideoComputeProvider[] = []) {
    initial.forEach(provider => this.register(provider));
  }

  register(provider: VideoComputeProvider) {
    this.providers.set(provider.providerId, provider);
    return this;
  }

  get(providerId: string) { return this.providers.get(providerId) || null; }
  list() { return [...this.providers.values()]; }
}

type CircuitState = { failures: number; openedAt: number | null };

export class CircuitBreaker {
  private readonly states = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  constructor(failureThreshold = 3, cooldownMs = 60_000, now = () => Date.now()) { this.failureThreshold = failureThreshold; this.cooldownMs = cooldownMs; this.now = now; }

  canRequest(providerId: string) {
    const state = this.states.get(providerId);
    if (!state?.openedAt) return true;
    if (this.now() - state.openedAt >= this.cooldownMs) {
      this.states.set(providerId, { failures: 0, openedAt: null });
      return true;
    }
    return false;
  }

  recordSuccess(providerId: string) { this.states.set(providerId, { failures: 0, openedAt: null }); }

  recordFailure(providerId: string) {
    const current = this.states.get(providerId) || { failures: 0, openedAt: null };
    const failures = current.failures + 1;
    this.states.set(providerId, { failures, openedAt: failures >= this.failureThreshold ? this.now() : null });
  }

  snapshot(providerId: string) { return this.states.get(providerId) || { failures: 0, openedAt: null }; }
}

let defaultRegistry: ProviderRegistry | null = null;
export function getDefaultProviderRegistry() {
  if (!defaultRegistry) defaultRegistry = new ProviderRegistry(createDefaultProviders());
  return defaultRegistry;
}
