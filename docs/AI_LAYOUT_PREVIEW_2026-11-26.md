# AI creation layout preview · 26 November 2026

Base: main at 809fab181dc0e86f3c85f2d83f414b447d1a67af.

The AI page now places voice previews on the left, existing recording/upload and meow-remix controls on the right, and the shared stage and save/export actions below. ElevenLabs backing music and pet-sound generation remain available in their own clearly labeled area. Four preview cards use existing bundled sound assets; the Bunny preview is labeled synthesized.

This is a presentation update. Existing controls are moved, preserving their IDs and listeners, and returned to their original locations in Manual Compose. The original music engine, meow-remix generator, composer, clip editor, WAV/video exporters, storage, ElevenLabs server and generation request code are unchanged.

The existing remix generator still requires an uploaded or recorded call for the selected pet. The preset chips preview bundled sounds; this layout does not add preset-based or automatic multi-pet remix generation. Known missing sample/export behavior for Hamster and Sea Otter remains a separate issue.

Validation: all JavaScript passed JavaScriptCore syntax checks; original HTML control IDs were retained; all referenced scripts/styles exist; the page, layout assets and four audio previews returned HTTP 200 from the local server. Protected source files were compared byte-for-byte with the base. Desktop/mobile rendering, microphone permissions, actual audio playback, saved-session exports and live paid API generation have not been browser-tested in this environment.

Local preview: http://127.0.0.1:8770/studio.html#ai

## Manual layout follow-up

Manual Compose now shares the AI header and segmented mode navigation. The stage and existing save/export controls occupy the left column; the existing pet mixer, sound inputs, rhythm/melody editor and sound settings occupy the right. At 800px and below the columns stack. Original controls are moved as DOM nodes only when entering Manual Compose; the AI stage/save routing remains in place.

Checks repeated after this change: all JavaScript parses; all original control IDs are retained; referenced files exist and the local preview serves the manual layout scripts/styles. Music, remix, composer, export, API, storage and original mode-routing scripts remain byte-for-byte identical to main 809fab1. Full browser rendering, mode-switch interaction, microphone, audio and live API tests remain unverified.

## Independent scrolling and shared stage position

Both modes now start their left column with the same performance heading and shared stage. In AI mode, examples follow the stage. In Manual Compose, scene shortcuts and save controls follow the stage. At widths above 900px, left and right panels have matching viewport-based heights and independent, visible scrollbars with contained wheel scrolling and keyboard focus. Smaller screens use normal vertical scrolling. No music or API handlers changed. JavaScript syntax and HTTP resource checks passed; browser rendering, wheel/touchpad behavior and mode switching still require visual verification.
