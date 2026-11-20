# Team handoff / 团队协作

Local revision of upstream main `b1f2926`. Keep your checkout intact. Review the changed files or apply the supplied `Lily_UI_changes.patch` against that exact base on your personal branch. Resolve newer teammate changes before applying.

先保留现有版本，在个人分支对比修改或应用补丁；不要覆盖组员新提交。本次没有推送、合并或部署。

UI: `lily-ui.css`, `lily-ui.js`, the HTML pages, `home.js` and `pets.js`. Studio interactions/save restoration: `app.js`, with existing composer/clip/audio modules retained. Export tooling: `design-export.js`, `design-states.html`, `design-states.js`, plus local-server export routes.

Preview using `python3 local_server.py` or `py local_server.py`. Check navigation, pet selection/dragging, templates, sound input, play/pause, save and reopen. Upstream image/audio assets were checked against the referenced snapshot.

When ready, make focused commits on the personal branch and open a PR with observed results and untested items. The team still needs a material-credit list and an uncoached user playtest.
