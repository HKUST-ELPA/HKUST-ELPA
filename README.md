# HKUST-ELPA-Site-Source

香港科技大学及香港科技大学（广州）学生维护的非官方 ELPA 口语备考网站。本仓库是唯一的源码与构建入口；生成的静态文件发布到 [HKUST-ELPA.github.io](https://github.com/HKUST-ELPA/HKUST-ELPA.github.io)，供 [GitHub Pages](https://hkust-elpa.github.io/) 和 [Vercel](https://hkust-elpa.vercel.app/) 使用。

[![Website validation](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/actions/workflows/site-checks.yml/badge.svg)](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/actions/workflows/site-checks.yml) [![Build and publish](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/actions/workflows/deploy-pages.yml)

![考试指南、抽题计时、笔记进度与考题分享演示](./assets/demos/feature-grid.gif)

## 网站功能

- **考试指南**：查阅常规 ELPA、Fast Track 流程与学生备考经验。
- **题库练习**：按校区、考试类型、场次、关键词和学习状态筛选，随机抽题并计时。
- **学习记录**：在本地浏览器保存掌握状态与笔记，支持备份和恢复。更换设备或网站地址前请先备份。
- **社区投稿**：通过 Cloudflare Worker 提交回忆题目或经验，由维护者审核后收录。

网站不代表学校官方立场；考试安排与要求以学校当期通知为准。投稿请勿包含姓名、学号或联系方式。

## 项目结构

```text
HKUST-ELPA-Site-Source/
├── .github/workflows/  # PR 验证、审核入库与跨仓库发布
├── assets/             # 样式、脚本与媒体
├── data/               # 投稿配置与学习记录模板
├── question-bank/      # 题库、场次、经验与出处
├── scripts/            # 静态构建、校验与审核入库
├── tests/              # 单元与浏览器回归测试
├── worker/             # Cloudflare 投稿接口
├── index.html          # 首页、指南和资料来源的内容入口
├── practice.html       # 题库练习
├── submit.html         # 社区投稿
├── preview.py          # 本地预览与静态构建入口
├── PUBLISHED_README.md # Published README 的唯一来源
└── requirements-dev.txt
```

## 技术栈

- **HTML / CSS / JavaScript**：静态页面、题库交互与本地学习记录
- **Python**：生成五个页面及浏览器题库资源
- **Cloudflare Worker + Turnstile**：校验投稿并创建 Source Issue
- **GitHub Issues + Actions**：审核入库、测试和跨仓库发布
- **GitHub App**：使用仅限 Published 仓库的短期 token 提交静态文件

## 本地开发

需要 Python 3.10+ 和 Node.js 22+。在 Source 根目录运行：

```sh
python preview.py
python preview.py --build-only
node scripts/validate-site.cjs
node --test
python -m unittest discover -s tests -t . -p "test_*.py"
```

Windows 可使用 `py -3` 替代 `python`。预览、浏览器回归和发布配置见 [PREVIEW.md](PREVIEW.md)。

## 构建与发布

**Source**（本仓库）维护页面、题库、投稿审核和唯一的生产构建。**Published**（`HKUST-ELPA/HKUST-ELPA.github.io`）只保存构建结果；GitHub Pages 与 Vercel 直接部署其 `main`，不再构建网站。Published 的 `README.md` 由 [PUBLISHED_README.md](PUBLISHED_README.md) 生成。

```mermaid
sequenceDiagram
    autonumber
    actor Student as 学生
    participant Worker as Cloudflare Worker
    participant Issue as Source Issue
    actor Maintainer as 维护者
    participant Source as Source main
    participant Action as 发布 Action
    participant App as GitHub App
    participant Published as Published main
    participant Hosts as Pages / Vercel

    opt 学生投稿并审核通过
        Student->>Worker: 提交题目或经验
        Worker->>Issue: 创建待审核 Issue
        Maintainer->>Issue: Close as completed
        Issue->>Source: 审核工作流写入题库
    end
    opt 日常代码或内容更新
        Maintainer->>Source: Push / merge
    end
    Source->>Action: main 更新或审核入库
    Note over Action: 测试并生成唯一 _site/
    Action->>App: 申请 Published 短期写入 token
    App-->>Action: Installation token
    opt 静态文件实际变化
        Action->>Published: App Bot 提交构建结果
        Published->>Hosts: 部署同一份静态文件
    end
```

发布工作流也支持手动触发。静态文件没有变化时不会产生 Published 提交；`build-info.json` 记录 Source 提交与构建运行，供追溯和回滚。学习记录只保存在用户浏览器，不进入仓库。

## 文档与参与

- [AGENTS.md](AGENTS.md)：工程原则与验证边界
- [PREVIEW.md](PREVIEW.md)：本地开发、凭据与部署操作
- [question-bank/README.md](question-bank/README.md)：题库结构与来源
- [question-bank/MODERATION.md](question-bank/MODERATION.md)：投稿审核与入库
- [worker/README.md](worker/README.md)：Worker 部署与安全配置
- [PUBLISHED_README.md](PUBLISHED_README.md)：Published README 的唯一来源

欢迎通过 [Issues](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/issues) 反馈资料问题，或通过 [Pull Requests](https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/pulls) 参与共建。

**Built with Passion. Shared with Everyone.** Initiated by [FuTseYi](https://github.com/FuTseYi).
