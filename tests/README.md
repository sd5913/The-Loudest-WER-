# Music Studio timing checks

Run the timing tests with Node.js. The browser smoke uses Python Playwright and Chromium as optional test tools. It starts a static server on localhost and uses local audio fixtures.

    node --test tests/pet-transport.test.mjs
    python3 tests/studio_transport_browser.py --chromium /path/to/chromium

To reproduce the old callback-driven timing, point the browser smoke at a checkout from before the transport change.

    python3 tests/studio_transport_browser.py --chromium /path/to/chromium --baseline --root /path/to/old/checkout

Each sequencer cell still takes one beat at the selected BPM. Live tempo changes retain the fractional beat and loop count so enabled cells cannot replay or disappear when the tempo changes. Edits rebuild the upcoming beat queue with a 5 ms scheduling margin. Audio queued before a short callback delay stays on time. After a longer stall, playback skips elapsed beats and resumes on the same grid.
