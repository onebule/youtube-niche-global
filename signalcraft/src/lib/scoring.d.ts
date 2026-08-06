export function calculateSignal(snapshot: Record<string, number>, baseline?: Record<string, number>): { viewsPerHour:number; viewsPerSubscriber:number; growthRate:number; velocityScore:number; outlierScore:number; confidence:number; opportunityScore:number; freshnessScore:number; engagementScore:number };
export function serializeFilters(filters:Record<string,string>): string;
export function parseFilters(search:string): { q:string; window:string; language:string; format:string; maxSubs:string; minScore:string; sort:string };
