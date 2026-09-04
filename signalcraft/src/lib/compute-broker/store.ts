import type { ComputeJob, ComputeJobStore } from './types.ts';

export class InMemoryComputeJobStore implements ComputeJobStore {
  private readonly jobs = new Map<string, ComputeJob>();

  async create(job: ComputeJob) { this.jobs.set(job.jobId, job); return job; }
  async get(jobId: string) { return this.jobs.get(jobId) || null; }
  async update(jobId: string, patch: Partial<ComputeJob>) {
    const current = this.jobs.get(jobId);
    if (!current) return null;
    const updated = { ...current, ...patch };
    this.jobs.set(jobId, updated);
    return updated;
  }
}

const globalKey = '__signalcraft_compute_job_store__';
export function getDefaultComputeJobStore() {
  const scope = globalThis as typeof globalThis & { [globalKey]?: InMemoryComputeJobStore };
  if (!scope[globalKey]) scope[globalKey] = new InMemoryComputeJobStore();
  return scope[globalKey];
}
