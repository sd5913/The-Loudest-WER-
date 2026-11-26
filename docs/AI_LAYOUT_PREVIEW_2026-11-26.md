# AI creation layout preview · 26 November 2026

Base: main at 809fab181dc0e86f3c85f2d83f414b447d1a67af.

The AI page now places voice previews on the left, existing recording/upload and meow-remix controls on the right, and the shared stage and save/export actions below. ElevenLabs backing music and pet-sound generation remain available in their own clearly labeled area. Four preview cards use existing bundled sound assets; the Bunny preview is labeled synthesized.

This is a presentation update. Existing controls are moved, preserving their IDs and listeners, and returned to their original locations in Manual Compose. The original music engine, meow-remix generator, composer, clip editor, WAV/video exporters, storage, ElevenLabs server and generation request code are unchanged.

The existing remix generator still requires an uploaded or recorded call for the selected pet. The preset chips preview bundled sounds; this layout does not add preset-based or automatic multi-pet remix generation. Known missing sample/export behavior for Hamster and Sea Otter remains a separate issue.

Validation: all JavaScript passed JavaScriptCore syntax checks; original HTML control IDs were retained; all referenced scripts/styles exist; the page, layout assets and four audio previews returned HTTP 200 from the local server. Protected source files were compared byte-for-byte with the base. Desktop/mobile rendering, microphone permissions, actual audio playback, saved-session exports and live paid API generation have not been browser-tested in this environment.

Local preview: http://127.0.0.1:8770/studio.html#ai
