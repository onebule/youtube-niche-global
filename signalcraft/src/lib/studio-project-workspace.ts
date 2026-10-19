import {
  createInfiniteProject, normalizeInfiniteWorkspace,
  type InfiniteCanvasProject, type InfiniteCanvasWorkspace,
} from './infinite-canvas-graph.ts';

/**
 * Local, Graph-v1-compatible project library for the gated Studio preview.
 * Pure transformations: no API, cloud sync, billing, storage or media writes.
 */
export const STUDIO_MAX_PROJECTS = 40;

function assertWorkspace(input: InfiniteCanvasWorkspace): InfiniteCanvasWorkspace {
  if (input.version !== 1 || !Array.isArray(input.projects) ||
      !input.projects.length || input.projects.length > STUDIO_MAX_PROJECTS) {
    throw new Error('工作区项目数量或格式无效。');
  }
  const ids = new Set<string>();
  for (const project of input.projects) {
    if (!project || project.version !== 1 || typeof project.id !== 'string' ||
        !project.id.trim() || project.id.length > 100 || ids.has(project.id) ||
        !Array.isArray(project.nodes) || !Array.isArray(project.edges)) {
      throw new Error('工作区包含无效或重复的项目 ID。');
    }
    ids.add(project.id);
  }
  if (!ids.has(input.activeProjectId)) throw new Error('工作区当前项目不存在。');
  return input;
}

function projectId(id: string): string {
  if (typeof id !== 'string' || !id.trim() || id.length > 100 || /[\u0000-\u001f]/.test(id)) {
    throw new Error('项目 ID 无效。');
  }
  return id;
}

function projectTitle(title: string): string {
  if (typeof title !== 'string') throw new Error('项目名称无效。');
  const value = title.trim();
  if (!value || value.length > 85 || /[\u0000-\u001f]/.test(value)) {
    throw new Error('项目名称必须为 1–85 个有效字符。');
  }
  return value;
}

export const studioWorkspaceFromProject = (project: InfiniteCanvasProject): InfiniteCanvasWorkspace =>
  assertWorkspace({ version: 1, activeProjectId: project.id, projects: [project] });

export function studioActiveProject(workspace: InfiniteCanvasWorkspace): InfiniteCanvasProject {
  assertWorkspace(workspace);
  return workspace.projects.find(project => project.id === workspace.activeProjectId)!;
}

export function studioCreateProject(
  workspace: InfiniteCanvasWorkspace, id: string, title: string,
): InfiniteCanvasWorkspace {
  assertWorkspace(workspace);
  projectId(id);
  const name = projectTitle(title);
  if (workspace.projects.length >= STUDIO_MAX_PROJECTS) throw new Error('最多可创建 40 个本地项目。');
  if (workspace.projects.some(project => project.id === id)) throw new Error('该项目 ID 已存在。');
  const created = createInfiniteProject(id, name);
  return {
    version: 1, activeProjectId: created.id,
    projects: [...workspace.projects, created],
  };
}

export function studioSwitchProject(
  workspace: InfiniteCanvasWorkspace, id: string,
): InfiniteCanvasWorkspace {
  assertWorkspace(workspace);
  if (!workspace.projects.some(project => project.id === id)) throw new Error('目标项目不存在。');
  return { ...workspace, activeProjectId: id };
}

export function studioRenameProject(
  workspace: InfiniteCanvasWorkspace, id: string, title: string,
): InfiniteCanvasWorkspace {
  assertWorkspace(workspace);
  const name = projectTitle(title);
  if (!workspace.projects.some(project => project.id === id)) throw new Error('待重命名的项目不存在。');
  return {
    ...workspace,
    projects: workspace.projects.map(project =>
      project.id === id ? { ...project, title: name } : project),
  };
}

export function studioRemoveProject(
  workspace: InfiniteCanvasWorkspace, id: string,
): InfiniteCanvasWorkspace {
  assertWorkspace(workspace);
  if (!workspace.projects.some(project => project.id === id)) throw new Error('待删除的项目不存在。');
  if (workspace.projects.length === 1) throw new Error('至少保留一个本地项目。');
  const projects = workspace.projects.filter(project => project.id !== id);
  return {
    version: 1,
    activeProjectId: workspace.activeProjectId === id
      ? projects[0].id : workspace.activeProjectId,
    projects,
  };
}

/**
 * Template clone, not media-result duplication:
 * - remaps all retained node IDs and retained edge IDs
 * - strips every asset reference, generation history and provider output
 * - skips video-result nodes and their edges entirely
 * - keeps prompts, storyboard/text, layout and nonexecuting model selections
 * - Graph-v1 normalizes the result to reject unsafe/malformed edges
 */
export function studioDuplicateProject(
  workspace: InfiniteCanvasWorkspace,
  sourceId: string,
  copyId: string,
  idFactory: () => string,
  copyTitle?: string,
): InfiniteCanvasWorkspace {
  assertWorkspace(workspace);
  projectId(copyId);
  const source = workspace.projects.find(project => project.id === sourceId);
  if (!source) throw new Error('待复制的项目不存在。');
  if (workspace.projects.length >= STUDIO_MAX_PROJECTS) throw new Error('最多可创建 40 个本地项目。');
  if (workspace.projects.some(project => project.id === copyId)) throw new Error('复制项目 ID 冲突。');
  const title = projectTitle(copyTitle ?? (source.title.slice(0, 80) + ' · 副本'));
  const allIds = new Set(workspace.projects.flatMap(project => [
    ...project.nodes.map(node => node.id),
    ...project.edges.map(edge => edge.id),
  ]));
  allIds.add(copyId);
  const fresh = () => {
    const id = idFactory();
    if (typeof id !== 'string' || !id.trim() || id.length > 100 || allIds.has(id)) {
      throw new Error('复制时生成的节点/连线 ID 无效或重复。');
    }
    allIds.add(id);
    return id;
  };
  const aliases = new Map<string, string>();
  const nodes = source.nodes.filter(node => node.kind !== 'video-result').map(node => {
    const id = fresh();
    aliases.set(node.id,id);
    return {
      ...node, id,
      assetId: null, assetName: null, output: null,
      width: null, height: null,
      runs: [],
      textResult: '',
    };
  });
  const edges = source.edges.flatMap(edge => {
    const from = aliases.get(edge.source), to = aliases.get(edge.target);
    return from && to ? [{ id: fresh(), source: from, target: to, port: edge.port }] : [];
  });
  const cloned = {
    ...createInfiniteProject(copyId,title),
    nodes, edges,
    view: { ...source.view },
  };
  const normalized = normalizeInfiniteWorkspace({
    version: 1, activeProjectId: copyId, projects: [cloned],
  },copyId);
  const copy = normalized.projects[0];
  if (copy.nodes.length !== nodes.length || copy.edges.length !== edges.length) {
    throw new Error('复制后的图包含不兼容的节点/连线，已取消整次操作。');
  }
  return {
    version: 1,
    activeProjectId: copy.id,
    projects: [...workspace.projects, copy],
  };
}


/**
 * Import external Graph v1 projects as new, sanitized structure-only templates.
 * Existing projects are never replaced; all-or-nothing on validation errors.
 * Even if an external file contains generated results, none become live assets.
 */
export function studioImportWorkspaceTemplates(
  current: InfiniteCanvasWorkspace,
  source: InfiniteCanvasWorkspace,
  makeProjectId: () => string,
  makeNodeId: () => string,
): InfiniteCanvasWorkspace {
  assertWorkspace(current);
  assertWorkspace(source);
  if (current.projects.length + source.projects.length > STUDIO_MAX_PROJECTS) {
    throw new Error('导入后将超过 40 个项目上限。');
  }
  let next = current;
  const existingIds = new Set(current.projects.flatMap(project =>
    [project.id, ...project.nodes.map(node => node.id),
      ...project.edges.map(edge => edge.id)]));
  for (const imported of source.projects) {
    const newProjectId = makeProjectId();
    if (typeof newProjectId !== 'string' || existingIds.has(newProjectId)) {
      throw new Error('导入新项目 ID 无效或重复。');
    }
    const staged = studioDuplicateProject(
      studioWorkspaceFromProject(imported),
      imported.id, newProjectId, makeNodeId,
      imported.title.slice(0, 80) + ' · 导入',
    );
    const copy = studioActiveProject(staged);
    const addedIds = [copy.id, ...copy.nodes.map(node => node.id), ...copy.edges.map(edge => edge.id)];
    if (addedIds.some(id => existingIds.has(id))) {
      throw new Error('导入项目节点或连线 ID 与已有项目冲突。');
    }
    for (const id of addedIds) existingIds.add(id);
    next = {
      version: 1,
      activeProjectId: copy.id,
      projects: [...next.projects,copy],
    };
  }
  return next;
}
