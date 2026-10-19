# SignalCraft × RunningHub — Phase 0 对照清单（2026-10-19）

> 状态：已创建隔离开发分支；**不是** 1:1 复刻完成报告。此文档仅记录可验证的公开入口、已有源码实现和下一轮工作。禁止未经授权访问私有界面或复制第三方代码、品牌、素材。

## 目标与不变量

- 用户目标：尽量复现 RunningHub 的功能、信息架构、页面交互和结果质量，同时保持 SignalCraft 自有品牌与合法使用的素材。
- 以实际页面、实际操作、真实任务执行证据验收；不能把 UI 骨架、模型目录或 mock 响应当作已完成。
- 原有 `/app/canvas` 和 legacy `VideoCanvasStudio` 完全保留，既有 YouTube 分析入口不变。
- **不修改生产数据库、不部署、不运行付费 AI / GPU、不更改信用积分、不运行数据库迁移**。
- 当前开发分支仅建立默认关闭的预览页 `/studio-parity`。仅设置 `STUDIO_PARITY_PREVIEW=enabled` 时可访问；不读取私人数据、不提交生成任务。
- 基准代码为前端 `main@3e5944918b0766c636f0e102a528882b3ca19efd`；在合并前必须核对 RC-2 本地改动、实际部署 SHA，避免覆盖较新版本。

## 一、公共原版引用（已核对的事实）

| 区域 | 可核对的公开入口 | 当前可见信息 | 证据等级 |
| --- | --- | --- | --- |
| 全球 rhTV | https://rhtv.runninghub.ai/projects | Create/Short drama/Interactive，Agent 输入，Recent projects，Inspirations | 公开页面文本 |
| rhTV 社区模板 | https://rhtv.runninghub.ai/projects/canvas/recommend?tab=workflow | Workflow Templates、Same Style、分类筛选、模板预览和保存 | 公开页面文本 |
| 全球 RunningHub 站点 | https://www.runninghub.com/ | 站点入口，结构需浏览器核对 | 待屏幕核对 |
| RunningHub 产品矩阵 | https://www.runninghub.cn/ | rhTV、短剧、快捷创作、AI Apps、ComfyUI、模型 API/工作流 API | 公开页面文本 |
| API 开发文档 | https://www.runninghub.cn/runninghub-api-doc-en/ | Model/AI App/Workflow/LLM API；异步 taskId 结果轮询 | 官方文档 |
| ComfyUI 接口 | https://rhtv.runninghub.cn/runninghub-api-doc-cn/doc-8287337 | 原生 ComfyUI 接口与模型管理 | 官方文档 |

**缺失证据：** 登录后 rhTV 画布精确布局、浮动面板和快捷键、画布菜单完整性、工作流导入导出、编辑器内部页面与 API 请求契约、成功生成后的回执与状态。需要有授权的浏览器手动录屏/截图，不可推测成「已经复刻」。

## 二、SignalCraft 已知可复用入口

| 功能 | 文件 | 现状/限制 |
| --- | --- | --- |
| 工作室主页路由 | `src/app/signalcraft-app.tsx` | `/app/canvas`，`/app/image-to-video` |
| 画布模式切换 | `src/app/canvas-route.tsx` | 新无限画布与 legacy 并存 |
| 无限画布 | `src/app/infinite-canvas-studio.tsx`, `src/lib/infinite-canvas-graph.ts` | 图片/文字/视频等节点；当前项目草稿存本地 localStorage |
| 旧镜头创作 | `src/app/video-canvas-studio.tsx` | Agent 提议/人工确认、GenerationJob |
| 模型生成后端 | `youtube-niche-global-api/vercel/lib/video-generation/` | Provider Router、队列、积分及质量检查 |
| Agent 规划后端 | `youtube-niche-global-api/vercel/lib/video-generation/video-agent-service.js` | 规则回退与 LLM 规划，**不是** DAG 自动执行 |
| 生成安全闸门 | `youtube-niche-global-api/vercel/lib/video-generation/execution-readiness.js` | 默认仅在满足执行条件后可人工单任务提交 |

## 三、复刻切片与验收表

| 批次 | 对标对象 | 需要真实验证的交互 | 完成标准 |
| --- | --- | --- | --- |
| S0 | rhTV 创作入口 | tab 切换、提示词、Agent/模型入口、最近项目、灵感发现 | 授权截图比对 + 键盘/移动端操作 |
| S1 | 无限画布 | pan/zoom、创建/删除/连线、节点参数、素材导入、撤销重做、保存 | 节点与项目跨会话可恢复；无破坏旧草稿 |
| S2 | Agent | 意图转多节点计划、预览执行图、修改节点、逐项审批 | 无许可付费调用为 0，Mock DAG 通过 |
| S3 | 多模型 | 图片、视频、音频、模型能力动态校验、统一资产 | 与提供商契约校验；授权真实任务留证据 |
| S4 | 剪辑 | 时间轴、字幕、音频混合、镜头组合、导出 | 生成可校验 MP4；部分失败可独立恢复 |
| S5 | ComfyUI | 导入合法 JSON、禁用危险自定义节点、沙箱执行 | 无网络外泄/越权，输出可回溯 |
| S6 | AI Apps/社区 | 模板发布、搜索、预览、收藏、运行、权限 | 版本化、授权校验、统计审计 |
| S7 | 平台基础 | API Key、账本、任务历史、多用户限额 | 无重复扣费、无跨租户访问 |

## 四、本分支已提交的代码范围

- `src/app/studio-parity/page.tsx`：预览环境标志门禁，搜索引擎禁止索引。
- `src/app/studio-parity/studio-parity-client.tsx`：创作入口的交互样板；所有可用按钮执行真实的本地动作或打开既有页面；不提供假的生成结果。
- `src/app/studio-parity/studio-parity.module.css`：页面隔离 CSS，不改全局现有工作室。
- 本预览只是原版 rhTV 公共入口**结构验证用切片**，不是原版内部 UI 的像素级还原。

## 五、实施闸门

1. 核对 `main`、RC-2、本地未提交改动与部署来源；任何差异先复核。
2. 获取获授权的 RunningHub 真实页面截图与操作录像（桌面 + 移动端）；确认页面元素、尺寸、视觉行为。
3. 用户已有 Agent/画布/账单数据不能丢；先制定 Graph v1→v2 的兼容读和回滚方案。
4. 模型调用先做 dry-run/Mock 测试；真实付费/API 凭证、生产 Supabase 和部署均需另行明确批准。
5. 所有发布必须独立评审、Typecheck、测试和安全检查通过；禁止自动合并。

## 六、Phase 1 隔离画布切片（2026-10-19）

已加入 `/studio-parity/canvas`，仅当服务端 `STUDIO_PARITY_PREVIEW=enabled` 时返回页面；与生产 `/app/canvas` 路由及原有 localStorage 命名空间完全分离。

- 复用现有 `createInfiniteNode` / `createInfiniteProject` / `connectionIssue` / `connectInfiniteNodes` / `normalizeInfiniteWorkspace`。
- 真实本地操作：添加节点、画布拖动和缩放、连接/断开、属性编辑、删除、撤销/重做、JSON 导入/导出、Nilo 示例工作流。
- 从创作首页明确点击“添加到实验画布”后，将原始描述作为本地文本节点追加到当前项目，不覆盖已有画布；**不调用大模型，不能算 Agent 工作流成功**。
- 有登录身份时按账户命名空间保存于 localStorage；未登录时只保存于当前标签的 sessionStorage。与原 `signalcraft-infinite-canvas-v5` 草稿隔离。
- 模型与媒体：节点仍为结构预览。图片/音频上传、真实生成、自动 DAG 执行、远程数据库保存、跨设备同步、ComfyUI、剪辑与开放 API **未实现**。
- 当前针对性静态检查可以验证代码引用、门禁与无付费调用路径；**尚未完成** next build、TypeScript 类型检查、Playwright/浏览器端到端验收，因此不得发布。
- UI 参考以 rhTV 创作入口、作品与工作流展示的公开页面为依据；画布内精确像素和登录态操作暂没有授权截图，不能标为 1:1 视觉完成。
- 下一操作：在具备可访问的本地开发机和已安装依赖的工作树中运行 `pnpm --dir signalcraft typecheck`、`pnpm --dir signalcraft test`、`pnpm --dir signalcraft build`，再测试移动端触屏、指针捕获、账号切换、导入失败、撤销重做及完整恢复流程。


## 七、继续开发：安全执行计划预览（2026-10-19）

- 新增 `src/lib/studio-workflow-plan.ts`：在现有 Graph v1 上做纯函数 Dry Run，按视频节点依赖进行稳定拓扑排序，识别循环依赖、失效连线、模型、提示词、素材等问题。
- 复用 `collectInfiniteGenerationInputs` 的模式与资产验证规则，避免预览与实际画布出现同一节点两个判断。
- 画布右侧可配置模型、时长、比例、参考模式；「检查工作流」显示依赖、阻塞原因和待人工预检状态。
- 新增 `tests/studio-workflow-plan.test.mjs` 六个测试案例，并注册到现有 `pnpm test` 命令。
- 所有 Dry Run 输出必须固定：`executionEnabled=false`、`estimatedCredits=null`、`paidJobs=0`。这不是生产执行许可，也不说明模型已配置。
- 已通过 GitHub 分支静态检查：两个预览入口均默认关闭；两套页面 CSS class 引用存在；新增 UI 与工作流规划函数没有服务端请求调用。**尚未运行 Node 单测、tsc、Next build 或浏览器端到端测试，不能宣称 PASS。**
- 本批提交只在 `codex/runninghub-parity-phase0-20261019`，不合并至 `main`，没有任何数据库迁移、生产部署或付费生成。
