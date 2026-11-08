# 开发与发布

## 本地预览和验证

需要 Python 3.10+ 与 Node.js 22+。在 Source 根目录运行：

```sh
python preview.py
python preview.py --build-only
node scripts/validate-site.cjs
node --test
python -m unittest discover -s tests -t . -p 'test_*.py'
```

Windows 可用 `py -3` 替代 `python`。预览地址为 `http://127.0.0.1:8765/`，静态输出在 `_site/`。界面改动另运行 `python tests/browser_smoke.py`；依赖见 `requirements-dev.txt`。

## 发布与凭据

Source 的 `site-checks.yml` 验证 PR；`deploy-pages.yml` 在 `main` 更新、手动触发或审核入库后执行测试、单次构建，再更新 Published。`publish-completed-submission.yml` 只接受 `FuTseYi` 以 **Close as completed** 审核 Source Issue；成功写入题库后触发发布。发布输出发生变化才提交；`build-info.json` 可追溯 Source SHA 与 Actions 运行。

为 Source 设置 Actions 变量 `PUBLISH_APP_ID` 与 Secret `PUBLISH_APP_PRIVATE_KEY`。GitHub App 必须安装到组织的 Published 仓库并具备 **Contents: Read and write**；工作流申请仅限 Published 的短期安装 token。Source 的 `GITHUB_TOKEN` 只读构建；审核入库工作流另需 Source Contents 和 Issues 写权限。不要把私钥或 Worker token 写进仓库。

Published 的 GitHub Pages 选择 `main` 分支根目录。Vercel 项目连接 Published `main`，使用仓库中的 `vercel.json`，不配置第二次 Python 构建。上线后查看 Source Actions、Published `build-info.json`、Pages URL 和 Vercel 部署，区分构建成功与上线成功。

投稿 Worker 的 GitHub 凭据需要仅限 Source 仓库、**Issues: Read and write**；Turnstile 允许实际站点域名。详见 [Worker 操作](worker/README.md)。迁移域名时提醒用户先备份旧地址上的本地学习记录，再在新地址恢复。
