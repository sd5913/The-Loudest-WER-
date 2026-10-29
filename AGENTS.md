# The Loudest WER! — Agent & Collaboration Guide / AI 与协作规范

## 1. Our shared goal / 我们的共同目标

**中文：** 我们要做一款手机和电脑浏览器都能使用的像素宠物音乐网页游戏。**音乐是核心，宠物是声音的可视化交互界面。** 开发前请先阅读 [`SPEC.md`](SPEC.md)；如果需求有冲突，先提问，不要擅自添加复杂功能。

**English:** We're making a pixel-pet music web game for mobile and desktop browsers. **Music comes first; pets visualize and control sound.** Read [`SPEC.md`](SPEC.md) before changing code. If requirements conflict, ask rather than inventing major features.

## 2. How we work with AI / 我们如何使用 AI

- **中文：** 我们先用简单的话说明要完成的一个小功能，再请 Agent 提出简短计划，然后逐步修改代码。
- **English:** We describe one small feature in plain language, ask the agent for a short plan, then implement it in small steps.
- **中文：** 我们优先采用简单、容易维护的 Web 技术；不要自行引入复杂框架、付费服务、账号系统或后端。
- **English:** We prefer simple, maintainable web technology. Don't introduce complex frameworks, paid services, accounts, or backends without team approval.
- **中文：** 我们每次修改后都检查页面是否正常运行、手机尺寸是否可用，以及声音功能是否真的有效。
- **English:** After each change, we check the page, mobile layout, and real sound behavior.
- **中文：** 我们希望 Agent 解释改了哪些文件、为什么修改、如何测试，以及已知问题。
- **English:** We expect the agent to explain changed files, reasons, testing steps, and known issues.

## 3. Git rules / Git 协作规范

- **中文：** 我们使用同一个仓库，主要在各自的个人分支上工作，不直接向 `main` 推送未经检查的修改。
- **English:** We work in one repository, primarily on individual branches, and don't push unreviewed changes directly to `main`.
- **分支 / Branches:** `feature/Eating`, `feature/ariaaaug`, `feature/yuanyuan`, `feature/youxiu`.
- **中文：** 我们每完成一个小功能或一项清晰的文档更新，就提交一次有意义的 Commit，不要等最后一天一次性提交。
- **English:** We commit after each small working feature or clear documentation update, rather than making one giant final commit.
- **中文：** 我们提交前检查 `git status` / diff，避免覆盖其他人的代码；完成后创建 Pull Request，说明改动和测试结果，经组员检查再合并。
- **English:** We review `git status` and the diff before committing, avoid overwriting teammates' work, and open a Pull Request with changes and test results for review before merging.
- **中文：** 我们不要在仓库里提交密钥、密码、隐私照片、未经允许使用的音频或不必要的大文件。
- **English:** We don't commit secrets, passwords, private photos, unlicensed audio, or unnecessary large files.

## 4. Definition of done / 怎样算完成

**中文：** 我们只有在功能可运行、基本交互经过测试、相关说明已更新且改动已提交到个人分支后，才把任务标为 Done。

**English:** We mark a task Done only when the feature runs, core interactions are tested, relevant notes are updated, and the work is committed to an individual branch.

## 5. File roles / 文件用途

- `SPEC.md` — 我们共同确认的产品需求。  
  Our agreed product requirements.
- `AGENTS.md` — 我们给 AI Agent 和团队的开发规则。  
  Our shared development rules.
- `README.md` — 我们对项目的公开介绍和运行指引。  
  Our public project overview and run guide.

**中文：** 如果某个功能还没实现，请明确标注为「计划中」，不要在 README 或演示中描述成已完成。

**English:** If a feature isn't implemented, label it as “Planned”; never describe it as already working in the README or demo.
