# ELPA 题库 · Question Bank

> **非官方学习资料。** 题目及考生经验由社区整理，不代表港科大官方题库；实际考试安排应以对应校区通知为准。

## 四个考试领域

| Domain | 校区 | 考试类型 | 题目 ID | 经验 ID | 审核 Team |
| --- | --- | --- | --- | --- | --- |
| `GZ-R` | 广州校区 | 常规 ELPA | `GZ-R-0001` | `GZ-R-E-0001` | `gz-regular-reviewers` |
| `GZ-F` | 广州校区 | ELPA Fast Track | `GZ-F-0001` | `GZ-F-E-0001` | `gz-fast-track-reviewers` |
| `HK-R` | 香港校区 | 常规 ELPA | `HK-R-0001` | `HK-R-E-0001` | `hk-regular-reviewers` |
| `HK-F` | 香港校区 | ELPA Fast Track | `HK-F-0001` | `HK-F-E-0001` | `hk-fast-track-reviewers` |

**`gz/hk` 是唯一校区数据值；`regular/fast-track` 是唯一考试类型数据值。** 题目 ID 由考试领域和该领域的递增编号组成，与 Issue 编号分离。经验在对应领域内独立编号，并明确记录 `campus` 和 `track`。不使用 A/B/C/D/F/H/T 旧编号或南沙/清水湾旧字段。

## 唯一数据源

- [questions.json](./questions.json)：四领域题库和 `historicalQuestionIds`；题目包含英文、中文、小问和来源信息。
- [appearances.json](./appearances.json)：经审核的考试场次与题目出现记录；补充问法不增加考试经历计数。
- [advice.json](./advice.json)：每份经验所属的校区、考试类型、阶段、标签和可选关联题目。
- [taxonomy.json](./taxonomy.json)：字段取值与中英文名称的统一规范。
- [2026-fall.md](./2026-fall.md)、[previous-years.md](./previous-years.md)、[fast-track.md](./fast-track.md)：原始资料背景与整理说明。

**只有 Source JSON 是结构化数据的权威来源。** `scripts/build-question-data.py` 将它们生成浏览器脚本；网站筛选及 Pagefind 使用相同的四领域分类。

## 投稿与审核

网站只发送 `version:3` 的结构化题目投稿：明确选择 `campus`、`track`、学期、阶段、英文题目和中文理解；可顺带附加同领域备考经验。Worker 通过 Turnstile 和限流检查后，以 GitHub App 身份创建公开 Issue。

Issue 自动进入 `campus:gz/hk`、`track:regular/fast-track` 的对应 Team 队列。该 Team 的有效成员或 Organization Owner 可以 **Close as completed** 审核通过。审核工作流验证成员资格及数据并以 GitHub App 提交 Source，随后统一构建到 Published。

详见 [MODERATION.md](./MODERATION.md)。

## 来源与使用说明

- [腾讯文档：ELPA 补充题库（8.25、8.26）](https://docs.qq.com/doc/DT3BxSkJzSGdUamJE)
- [腾讯文档：26 ELPA 旧新题整理](https://docs.qq.com/doc/DSHJydEVYSHBtdkZO)
- [有道云：ELPA 笔记分享](https://share.note.youdao.com/ynoteshare/index.html?_time=1788671277918&id=c753f55564beca3902cdaab5e1273c87&type=note)

资料可能包括现场回忆、整理后的英文练习表述和中文释义；不要将后期改写冒充现场逐字题卡。题目与经验可在 [网站题库](https://hkust-elpa.github.io/practice.html) 和 [备考指南](https://hkust-elpa.github.io/guide.html) 中按校区及类型查阅。
