/** Stable entrances and existing save keys. Never migrate one workspace into the other. */
export const CREATION_WORKSPACES = {
  infinite: { path: '/app/canvas', storageKey: 'signalcraft-infinite-canvas-v5' },
  shots: { path: '/app/shot-workspace', storageKey: 'signalcraft-video-canvas-v1' },
} as const;

type ProjectGeneration = {
  generationGroupId?: string | null;
  generationSpec?: { generationGroupId?: string | null } | null;
};

export function belongsToShotProject(generation: ProjectGeneration, projectId: string) {
  const groupId = generation.generationGroupId || generation.generationSpec?.generationGroupId;
  return Boolean(projectId && groupId && groupId === projectId);
}

/** The API remains account-scoped. Advance its cursor using RAW results, not filtered rows. */
export function scopedShotHistoryPage<T extends ProjectGeneration>(page: T[], projectId: string, offset: number, limit = 20) {
  return {
    items: page.filter(item => belongsToShotProject(item, projectId)),
    nextOffset: offset + page.length,
    hasMore: page.length === limit,
  };
}
