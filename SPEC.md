# The Loudest WER! — Project Specification / 项目需求说明

> **Status / 状态:** for team review / 供小组讨论  
> **Course / 课程:** SD5913  
> **Platform / 平台:** Responsive Web, usable on mobile and desktop browsers / 响应式网页，手机和电脑浏览器都能使用

## 1. What we're building / 我们要做什么

**中文：** 我们正在制作一款以**音乐创作**为核心的像素宠物互动网页游戏。我们用宠物角色展示不同声音，让没有养宠物、也不懂音乐的人能轻松做出一段有趣的合奏。宠物是音乐的可视化交互界面，而不是复杂的养成系统。

**English:** We're building a pixel-pet web game focused on **making music**. We use animated pets to represent sounds so anyone—even without a pet or musical experience—can create a playful ensemble. Pets are our visual interface for music, not a complex pet-raising system.

## 2. Look and feel / 画面与布局

- **中文：** 我们采用深色色调的像素风格，画面有趣、清晰。第一版只做一个背景；可选场景包括开阔公园、带步行道的海滨公园、室内演播厅。宠物围绕中央麦克风呈半圆形站立，正在发声的宠物会张嘴或轻轻跳动。
- **English:** We're using dark-toned, playful, readable pixel art. We'll build one background first, choosing from an open park, a seaside park with a walking path, or an indoor studio. Pets stand in a semicircle around a central microphone and animate when their sounds play.
- **中文：** 我们优先支持手机浏览器，保持舞台和核心按钮清晰可见；具体使用竖屏或横屏，待原型测试后确定。
- **English:** We'll prioritize mobile browsers while keeping the stage and primary controls visible. We'll decide portrait vs. landscape after testing a prototype.

## 3. First playable version (MVP) / 第一版必须能玩

| Feature / 功能 | Our expected behavior / 我们希望发生什么 |
| --- | --- |
| Default pets / 内置宠物 | 我们默认提供 2–3 只宠物（拟定猫、狗、鸟），没有真实宠物也能玩。 / We provide 2–3 starter pets (tentatively cat, dog, bird), so no real pet is required. |
| Add / remove / 添加与移除 | 我们点击 Add Pet 打开选择面板；选中后加入舞台，可移除。 / We tap Add Pet to open a picker, add the chosen pet to the stage, or remove it. |
| Sound per pet / 每只宠物的声音 | 我们先提供可直接播放的预设叫声。 / We start with playable preset pet sounds. |
| Sound controls / 声音控制 | 我们选中宠物后调节 Volume（音量）、Pitch（音高）、Rhythm（触发节奏）、Repeat（重复方式）。 / After selecting a pet, we adjust volume, pitch, trigger rhythm, and repetition. |
| Play / Pause / 播放暂停 | 我们点击 Play，让已启用的宠物按共同节拍合奏；Pause 暂停合奏。 / Play starts enabled pets on a shared beat; Pause pauses the ensemble. |
| Templates / 音乐模板 | 我们提供 2–3 种简单节奏模板，自动分配宠物叫声；仍可手动修改。 / We offer 2–3 simple rhythm templates that arrange pet sounds automatically, while allowing manual edits. |
| Surprise Me / 随机合奏 | 我们点击 Surprise Me，从预设节奏与声音组合中随机生成一段合奏，不依赖 AI 音乐生成。 / Surprise Me picks a playable combination of preset rhythms and sounds; it doesn't require generative AI. |
| Visual feedback / 动画反馈 | 我们让正在发声的宠物播放简短动画。 / We animate pets when they make sounds. |

## 4. User journey / 玩家怎么操作

**Easy mode / 轻松模式**  
中文：我们打开网页 → 使用内置宠物 → 选择模板或 Surprise Me → 点击 Play → 调整喜欢的声音。  
English: We open the page → use starter pets → choose a template or Surprise Me → press Play → tweak the sounds.

**Creative mode / 自由模式**  
中文：我们添加宠物 → 选择叫声 → 调节滑块与节奏 → 合奏 → 继续修改。  
English: We add pets → choose sounds → adjust sliders and rhythm → play together → refine our mix.

两种模式共用同一个舞台和编辑界面，不必开发两套独立页面。  
Both modes share one stage and editor; we don't need two separate applications.

## 5. Interaction rules / 具体交互

- **Add Pet / 添加宠物：** 我们打开宠物选择面板；选择后，舞台与音轨同时新增这只宠物。 / We open a pet picker; choosing one adds it to the stage and the sound tracks.
- **Select Pet / 选择宠物：** 我们点击宠物，就能看到该宠物的声音设置。 / We tap a pet to open its sound settings.
- **Sliders / 滑块：** 我们只修改当前选中的宠物；拖动后能立即听到或在下次播放时听到变化。 / Sliders affect only the selected pet; changes are audible immediately or on the next playback.
- **Template / 模板：** 我们选择模板后，系统载入预设的节奏安排。 / Choosing a template loads a preset rhythm arrangement.
- **Surprise Me / 随机：** 我们点击后重新组合预设声音和节奏，仍可手动编辑。 / We reshuffle preset sounds and rhythms, then can edit the result.
- **Play / Pause：** 我们使用同一套节拍控制所有已启用宠物。 / We use one shared beat to control all enabled pets.
- **Mobile / 手机：** 我们确保主要操作可触摸使用，不要求安装 App。 / We keep primary controls touch-friendly and require no app installation.

**Implementation decisions still open / 开发前仍需确定：** slider ranges, rhythm grid/steps, maximum number of pets, audio asset licenses, and how to handle browser audio permissions. / 滑块范围、节奏格数、宠物上限、音效授权以及浏览器音频权限处理。

## 6. Later features (not required for MVP) / 后续功能（第一版不强求）

- 中文：我们希望支持录制或上传真实宠物叫声、用照片生成像素宠物、自由编排更细的音轨、保存或导出音乐、更多场景和简单桌宠模式。
- English: We'd like to add recording/uploading real pet sounds, turning photos into pixel pets, finer track editing, saving/exporting music, extra scenes, and a simple desktop-pet mode later.

## 7. How we'll know it works / 验收标准

- 中文：我们能在手机和电脑浏览器打开网页；使用内置宠物，无需上传任何内容；至少两只宠物能够按同一节拍合奏；声音控制确实改变播放结果；模板和随机功能产生可播放的组合；播放时有清楚的视觉反馈。
- English: We can open the game on mobile and desktop, play without uploading anything, hear at least two pets together on a shared beat, verify that sound controls change playback, use templates/randomize to get playable results, and see clear animations during playback.
