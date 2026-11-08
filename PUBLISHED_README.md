# HKUST-ELPA.github.io

本仓库只保存自动生成的网站文件。源码、题库、审核记录与构建工作流位于 [HKUST-ELPA-Site-Source](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source)。请在 Source 提交修改，不要直接修改本仓库。

Source Actions 构建并验证 `_site/` 后，通过仅限本仓库的 GitHub App 短期 token 发布。GitHub Pages 和 Vercel 直接部署本仓库 `main`，不重复构建。`build-info.json` 记录源码提交与构建运行。
