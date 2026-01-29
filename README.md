<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>


# Pathology Data Annotation Tool 网页版

本项目已支持网页端访问，无需本地环境即可直接使用。

## 在线访问

你可以通过 GitHub Pages 在线访问和使用本工具：

```
https://Xueqiaochu.github.io/Patho-Annotation/
```

> 如果你 fork 或迁移了本项目，请将上方链接中的用户名和仓库名替换为你自己的。

## 本地运行

**前置条件：** 需安装 Node.js

1. 安装依赖：
   ```sh
   npm install
   ```
2. 配置 API Key（如需）：
   在 [.env.local](.env.local) 文件中设置 `GEMINI_API_KEY`
3. 启动本地开发服务器：
   ```sh
   npm run dev
   ```

## 部署到 GitHub Pages

1. 修改 `package.json` 中的 `homepage` 字段为你的仓库地址。
2. 执行：
   ```sh
   npm run deploy
   ```
3. 稍等片刻，即可通过 GitHub Pages 访问。
