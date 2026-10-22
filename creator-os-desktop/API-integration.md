# niqivo.top 接口复用核对

## 已定位项目
- 前端：https://github.com/onebule/youtube-niche-global （signalcraft 子目录）
- 后端：https://github.com/onebule/youtube-niche-global-api （vercel 子目录，已通过连接器读取 README）
- 本地前端源码：/workspace/niqivo-source
- 网关：https://youtube-niche-global-api.vercel.app/api/video

## 已有客户端契约
- GET /models：模型与可用性。
- GET /image-models：图片模型。
- POST /image-generate：图片生成。
- GET /image-status?taskId=：图片状态。
- POST /upload-intent + 返回地址 PUT：上传参考素材。
- POST /agent-plan：制作规划。
- POST /ocr-script：读取脚本图片。
- POST /generate：视频生成。
- GET /status?generationId=：生成状态。
- POST /cancel：取消。
- GET /history：历史。
- GET /asset-url：结果预览或下载。
- POST /api/longform-production：制作方案及 AI_PRODUCTION_ANALYSIS。
- /api/workspace：工作空间数据；必须保留文档版本和 revision 机制，不能用新工作台任务结构覆盖旧记录。

## 只读线上验证
- GET capabilities 返回 200，声明 APIMart 服务端网关及生成、状态、取消和素材接口。
- GET image-models 未登录返回 401 AUTH_REQUIRED。
- GET models 返回 auto、seedance-2、seedance-2-5、minimax-h3、kling-3、veo-3.1-lite；本次未登录请求 enabled 均为 false。这不能证明登录主人后仍不可用。
- 未提交任何生成请求或消耗模型额度。

## 集成结论
可复用原网站登录、服务端网关、素材与生成生命周期。建议在原 Next.js 项目内加入运营工作台，继承当前会话和服务端密钥配置。当前静态原型尚未连接这些接口。
现有单任务生成不能等同于截图所需批量队列；批量进度、限流、失败重试、任务持久化仍需补齐。
公开 YouTube 数据不能代替 YouTube Analytics 的私人收入、CTR、留存与精确每日订阅数据。
