# YouTube 全球赛道分析器：GitHub Pages + Vercel

## 1. 上传到 GitHub

将整个文件夹上传至一个新的 GitHub 仓库。进入仓库的 **Settings → Pages**，在 **Build and deployment** 中选择：

- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/docs`

保存后，GitHub 会给出网页地址。

## 2. 部署安全的分析接口

在 Vercel 导入同一个 GitHub 仓库，并将 **Root Directory** 设置为 `vercel`。在项目的 **Settings → Environment Variables** 中新增：

| Name | Value |
| --- | --- |
| `YOUTUBE_API_KEY` | 你的 YouTube Data API v3 Key |

部署完成后，复制 Vercel 域名，例如 `https://my-youtube-tool.vercel.app`。

## 3. 连接网页和接口

编辑 `docs/config.js`，将 `https://YOUR-VERCEL-PROJECT.vercel.app` 替换为你的 Vercel 域名，然后提交这一个修改。API Key 不应写进该文件。

此时 GitHub Pages 网页即可使用 Vercel 后端请求 YouTube；访客无法看到你的 API Key。
