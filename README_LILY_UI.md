# The Loudest WER! · Lily UI revision

Based on upstream main `b1f292635bf01d6c31f4baafb37150419b0364b3` and the 19 November 2026 group discussion. Local files only; not pushed, merged or deployed.

基于指定main快照及11月19日讨论的本地界面修改版，没有上传或发布。

## Preview / 本地预览

```sh
python3 local_server.py
```

Windows: `py local_server.py`. Open [Home](http://localhost:8766/index.html) or [Studio](http://localhost:8766/studio.html). Keep the terminal running; stop with Ctrl+C. No build step or package installation is needed.

In **Manual Compose**, select a pet and upload a short call (up to 3 seconds after trimming silence) or record for up to 12 seconds (long takes are cropped to the strongest 3 seconds). Open **Turn a pet call into a song**, then click **Generate meow song** to pick one of twelve styles at random. Click **Generate another remix** to use the same recording with a different style, including Swing Jazz, Garage Rock, Punk Rock and Trap. This replaces the selected pet's melody and sets the session tempo, key, meter and eight-bar length. When **Song ready!** appears, click **Play / pause remix** or **Play together** to hear a short slice of the original call pitched into a randomized one-octave melody shaped by its pitch contour, with chord tones on bar downbeats and a tonic ending, with style-specific offbeat cat notes and drum subdivisions at 112?160 BPM. The second half adds vocal accents, denser drums, bass and syncopated chords. Each phrase opens with a longer natural call, and sung notes stay in the octave closest to the recorded pitch. You can edit the generated notes, toggle **Chords and beat**, save to **My Collection**, or export a WAV. The remix runs locally in the browser.

## Changes / 修改内容

- English-only UI, fewer duplicate entry points, larger room/stage and clearer controls.
- Brief guide on the Home computer; pets drag directly and retain positions per scene.
- Mixer pet shortcuts; circular stage-scene shortcuts; section length in the rhythm track area.
- Visible sound drop zone, trim controls and optional backing-song panel after sound import.
- Preserved main's Beginner/Advanced modes, templates, instruments, melody, chords, animation and WAV export.
- Persisted custom voice names, audio data, pet identity and normalization settings; restored custom sound UI after decoding.
- Collection now says **Copy local link**. Use **Export WAV** to share audio with others.

首页原图保留白猫、橘猫、神秘猫装饰；工作室按当前main使用灰猫、腊肠犬、萨摩耶，并提供仓鼠、海獭。

## Guides / 说明

- [Website controls / 网站操作](docs/WEBSITE_GUIDE.md)
- [Team handoff / 团队协作](docs/TEAM_GUIDE.md)
- [Dated development review / 开发验证记录](docs/UI_REVIEW_2026-11-19.md)

The separate SVG pack contains 74 page/interaction states plus standalone component SVGs. Place the pack in `figma-svg/` to use the [visual index](figma-svg/index.html). UI text/shapes are SVG elements; pixel artwork and canvas previews remain separate embedded images. SVG is a static handoff, not a wired Figma prototype or automatic Auto Layout.

可编辑SVG包含独立文字、图形和图片图层；像素背景、宠物、波形仍为位图。导入后字体是否保持原生文字层取决于Figma的SVG解析与字体匹配。

For fresh exports, open [the local exporter](http://localhost:8766/design-states.html). It uses synthetic audio/project artwork and restores preview-origin storage after running. Add `?design=1` to a page for a single-state export button.

Photos are pixelated previews, not AI cutouts. Saves remain in this browser. Optional ElevenLabs panels require local configuration and may incur provider charges when used; no provider requests were made during these checks. Real recording, perceptual audio quality, provider generation and a real-user playtest still need team verification.
