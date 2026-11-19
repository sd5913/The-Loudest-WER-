"""Run against a local Chromium with Python Playwright installed."""
import argparse
import base64
import functools
import http.server
import io
import math
from pathlib import Path
import struct
import threading
import wave

from playwright.sync_api import sync_playwright


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def setup(page, url):
    page.goto(url)
    page.wait_for_function("samplesReady")
    page.evaluate("""() => {
        $('#tempo').value = '160';
        pets.forEach((pet, i) => {
            pet.muted = i !== 0;
            pet.steps = Array.from({length: 16}, (_, step) => step);
        });
        render();
        window.probe = {steps: [], hits: [], voices: []};
    }""")


def baseline(page):
    page.evaluate("""() => {
        const original = sound;
        sound = (...args) => {
            if (args[1]) probe.steps.push({step: beat, at: args[1], queued: context.currentTime});
            return original(...args);
        };
    }""")
    page.locator('#play').click()
    page.wait_for_function("probe.steps.length >= 2")
    page.evaluate("() => { const end = performance.now() + 820; while (performance.now() < end) {} }")
    page.wait_for_function("probe.steps.length >= 5")
    steps = page.evaluate("probe.steps")
    assert any(b['step'] - a['step'] > 1 for a, b in zip(steps, steps[1:])), steps
    assert all(abs(event['at'] - event['queued'] - .035) < .004 for event in steps), steps
    print(f"Baseline with 820 ms stall: steps {[event['step'] for event in steps]}; each queued ~35 ms after callback")


def instrument(page):
    page.evaluate("""() => {
        const originalStep = schedulePetStep;
        schedulePetStep = (step, loop, at) => {
            const event = originalStep(step, loop, at);
            const entry = {step, loop, at, queued: context.currentTime, hits: event.hits, cancelled: false};
            probe.steps.push(entry);
            return {...event, cancel: () => { entry.cancelled = true; event.cancel() }};
        };
        const originalAnimate = animate;
        animate = id => {
            probe.hits.push({id, beat, at: context.currentTime,
                highlighted: Boolean(document.querySelector('.track-steps [data-step="'+beat+'"].current'))});
            originalAnimate(id);
        };
        const originalStartVoice = startVoice;
        startVoice = (source, gain, pet, time, end, range, stepAudio) => {
            originalStartVoice(source, gain, pet, time, end, range, stepAudio);
            probe.voices.push({id: pet.id, time, end, range, pitch: pet.pitch, echo: pet.echo,
                tone: pet.tone, source: pet.source, sequenced: Boolean(stepAudio)});
        };
    }""")


def queued(page, step):
    page.wait_for_function("""step => probe.steps.some(event =>
        event.step === step && !event.cancelled && event.at > context.currentTime + .04)""", arg=step)


def timing_and_edits(page):
    page.locator('#play').click()
    page.wait_for_function("probe.hits.length >= 1")
    page.evaluate("""() => {
        window.outputProbe = context.createAnalyser();
        masterGain.connect(outputProbe);
    }""")
    first, first_hit = page.evaluate("[probe.steps[0], probe.hits[0]]")
    assert first['step'] == first_hit['beat'] == 0 and first_hit['highlighted']
    assert first['at'] > first['queued'] and 0 <= first_hit['at'] - first['at'] < .075

    queued(page, 1)
    page.evaluate("""() => {
        const end = performance.now() + (probe.steps[1].at - context.currentTime) * 1000 + 35;
        while (performance.now() < end) {}
    }""")
    page.wait_for_function("probe.hits.some(hit => hit.beat === 1)")
    second = page.evaluate("probe.steps[1]")
    assert abs(second['at'] - first['at'] - .375) < 1e-8, second
    assert second['at'] - second['queued'] > .04, second

    queued(page, 2)
    page.evaluate("""() => {
        const edit = $('.track-steps [data-track="cat"][data-step="2"]');
        edit.click();
    }""")
    page.wait_for_function("beat === 2")
    edited = page.evaluate("probe.steps.filter(event => event.step === 2)")
    assert len(edited) == 2 and edited[0]['cancelled'] and edited[1]['hits'] == [], edited
    assert edited[0]['at'] == edited[1]['at']
    assert not page.evaluate("probe.hits.some(hit => hit.beat === 2)")

    queued(page, 3)
    page.evaluate("""() => {
        const input = $('#tempo');
        input.value = '120';
        input.dispatchEvent(new Event('input', {bubbles: true}));
    }""")
    page.wait_for_function("probe.hits.some(hit => hit.beat === 4)")
    third, fourth = page.evaluate("probe.steps.filter(event => [3,4].includes(event.step) && !event.cancelled)")
    assert abs(fourth['at'] - third['at'] - .5) < 1e-8
    assert page.evaluate("probe.steps.filter(event => event.step === 3 && event.cancelled).length") == 1
    assert page.evaluate("probe.hits.filter(hit => hit.beat === 3).length") == 1

    # Sample after the actual limiter and master gain, past the cancellation buses.
    peak = page.evaluate("""async () => {
        const samples = new Float32Array(outputProbe.fftSize);
        let peak = 0;
        for (let i = 0; i < 9; i++) {
            await new Promise(requestAnimationFrame);
            outputProbe.getFloatTimeDomainData(samples);
            peak = Math.max(peak, ...samples.map(Math.abs));
        }
        return peak;
    }""")
    assert peak > .004, peak

    stalled = page.evaluate("""() => {
        const before = probe.steps.at(-1);
        const end = performance.now() + 1180;
        while (performance.now() < end) {}
        return before;
    }""")
    page.wait_for_function("at => probe.steps.some(event => event.at > at)", arg=stalled['at'])
    recovered = page.evaluate("at => probe.steps.find(event => event.at > at)", stalled['at'])
    assert recovered['step'] > stalled['step'] + 1, [stalled, recovered]
    assert abs((recovered['at'] - fourth['at']) / .5 - (recovered['step'] - 4)) < 1e-8
    assert recovered['at'] > recovered['queued'], recovered
    print(f"Timing/edit: exact 375/500 ms beat spacing, measured signal {peak:.3f}; "
          f"stall skipped from step {stalled['step']} to {recovered['step']}")


def stop_restart_and_suspend(page):
    next_step = page.evaluate("probe.steps.at(-1).step + 1")
    queued(page, next_step)
    stopped = page.evaluate("""() => {
        const event = probe.steps.at(-1);
        $('#stop').click();
        return {event, playing, beat, highlight: Boolean($('.track-steps .current'))};
    }""")
    assert stopped['event']['cancelled'] and not stopped['playing'] and stopped['beat'] == -1
    assert not stopped['highlight']
    page.wait_for_function("context.state === 'suspended'")
    residual = page.evaluate("""async () => {
        // Keep the analyser running when the sequencer disconnects its input.
        const floor = context.createConstantSource();
        floor.offset.value = .00001;
        floor.connect(outputProbe);
        floor.start();
        await context.resume();
        const samples = new Float32Array(outputProbe.fftSize);
        let peak = 0;
        for (let i = 0; i < 19; i++) {
            await new Promise(requestAnimationFrame);
            if (i < 3) continue;
            outputProbe.getFloatTimeDomainData(samples);
            peak = Math.max(peak, ...samples.map(Math.abs));
        }
        floor.stop();
        await context.suspend();
        return peak;
    }""")
    assert residual < .0001, residual
    page.evaluate("probe.steps = []; probe.hits = []")
    page.locator('#play').click()
    page.wait_for_function("probe.hits.length === 1")
    assert page.evaluate("probe.hits[0].beat") == 0

    queued(page, 1)
    frozen = page.evaluate("""async () => {
        await context.suspend();
        const start = context.currentTime, count = probe.steps.length;
        await new Promise(resolve => setTimeout(resolve, 230));
        const result = {delta: context.currentTime - start, newSteps: probe.steps.length - count};
        await context.resume();
        return result;
    }""")
    assert frozen == {'delta': 0, 'newSteps': 0}, frozen
    page.wait_for_function("probe.hits.some(hit => hit.beat === 1)")
    assert page.evaluate("probe.steps.filter(event => event.step === 1).length") == 1

    page.locator('#restart').click()
    page.wait_for_function("probe.hits.filter(hit => hit.beat === 0).length === 2")
    assert page.evaluate("probe.steps.at(-1).loop === 0 && probe.steps.at(-1).step === 0")
    page.locator('#play').click()
    page.wait_for_function("!playing && context.state === 'suspended'")
    page.locator('#play').click()
    page.wait_for_function("probe.hits.filter(hit => hit.beat === 0).length === 3")
    page.locator('#stop').click()
    print("Stop/restart: queued source cancelled, playhead cleared, restart at beat one, suspend froze clock without duplicates")


def repeats(page):
    page.evaluate("""() => {
        const select = $('#meter');
        select.value = '3/4';
        select.dispatchEvent(new Event('change'));
        $('#tempo').value = '160';
        pets.forEach((pet, i) => {
            pet.muted = false;
            pet.steps = [0, 11];
            pet.repeat = ['alternate', 'once', 'loop'][i];
        });
        probe.steps = [];
        render();
    }""")
    page.locator('#play').click()
    page.wait_for_function("probe.steps.some(event => event.loop === 2 && event.step === 0)", timeout=14000)
    downbeats = page.evaluate("probe.steps.filter(event => event.step === 0).map(event => event.hits)")
    assert downbeats == [['cat', 'ghost-cat', 'bat-cat'], ['bat-cat'], ['cat', 'bat-cat']], downbeats
    page.locator('#loopPlayback').uncheck()
    page.wait_for_function("!playing")
    page.evaluate("probe.steps = []")
    page.locator('#play').click()
    page.wait_for_function("!playing && $('#toast').textContent.includes('Phrase finished')", timeout=6500)
    events = page.evaluate("probe.steps")
    assert [event['step'] for event in events] == list(range(12)), events
    assert all(event['loop'] == 0 for event in events)
    print("Repeats: three loop downbeats match always/alternate/once; one-shot completed exactly 12 steps")


def sample_wav(duration=.3):
    file = io.BytesIO()
    with wave.open(file, 'wb') as wav:
        wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', round(8000 * math.sin(i * .16))) for i in range(round(8000 * duration))))
    return file.getvalue()


def custom_and_saved(page, url):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#voiceUpload').set_input_files({
        'name': 'timing-fixture.wav', 'mimeType': 'audio/wav', 'buffer': sample_wav()
    })
    page.wait_for_function("probe.voices.some(voice => voice.tone === 'custom' && !voice.sequenced)")
    page.evaluate("""() => {
        const edit = (id, value) => {
            const input = $('#'+id);
            input.value = value;
            input.dispatchEvent(new Event('input', {bubbles:true}));
        };
        edit('pitch', '5');
        edit('echo', '35');
        $('#clipEndHandle').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'}));
        $('#preview').click();
    }""")
    page.wait_for_function("""probe.voices.some(voice =>
        voice.tone === 'custom' && voice.pitch === 5 && voice.echo === 35 && !voice.sequenced)""")
    page.locator('#saveSong').click()
    page.locator('#songName').fill('Transport smoke')
    page.locator('#saveForm button[type=submit]').click()
    song = page.evaluate("WERStore.getSongs().find(song => song.name === 'Transport smoke')")
    assert song['pets'][0]['clipEnd'] < 1 and song['pets'][0]['customAudioData']
    page.goto(f"{url}?song={song['id']}")
    page.wait_for_function("samplesReady && customBuffers.has('cat')")
    page.evaluate("window.probe = {steps: [], hits: [], voices: []}")
    instrument(page)
    page.locator('#play').click()
    page.wait_for_function("probe.hits.length >= 1")
    assert page.evaluate("""probe.voices.some(voice =>
        voice.id === 'cat' && voice.tone === 'custom' && voice.pitch === 5 && voice.echo === 35 &&
        voice.range.duration > 0 && voice.range.duration < customBuffers.get('cat').duration &&
        voice.sequenced)""")
    assert page.locator('#play').is_visible()
    page.locator('#stop').click()
    print("Narrow viewport: imported and previewed a custom WAV, saved and reopened pitch/trim/echo, played it through transport")


def backing_track(page):
    wav = 'data:audio/wav;base64,' + base64.b64encode(sample_wav(.9)).decode()
    page.evaluate("""wav => {
        aiSongData = wav;
        aiSongRange = {start: .1, end: .7};
        loopPlayback = true;
        showAiSong();
        const audio = $('#aiSongAudio'), play = audio.play.bind(audio);
        window.backingStarts = [];
        audio.play = () => {
            backingStarts.push({at: audio.currentTime, rate: audio.playbackRate});
            return play();
        };
    }""", wav)
    page.wait_for_function("$('#aiSongAudio').readyState >= 2 && $('#aiSongStart').max !== '0'")
    page.locator('#play').click()
    page.wait_for_function("!$('#aiSongAudio').paused")
    page.evaluate("""() => {
        $('#tempo').value = '110';
        $('#tempo').dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    assert page.evaluate("backingStarts.length === 1 && $('#aiSongAudio').playbackRate === 1")
    page.locator('#restart').click()
    page.wait_for_function("backingStarts.length === 2")
    starts = page.evaluate("backingStarts")
    assert all(abs(start['at'] - .1) < .001 and start['rate'] == 1 for start in starts), starts
    page.locator('#stop').click()
    assert page.evaluate("$('#aiSongAudio').paused")
    print("Backing fixture: independent media start/restart at trim point, 1× through tempo changes, paused on stop")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', help='Path to Chromium or a Chromium headless shell')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--baseline', action='store_true', help='Probe the old transport in an original checkout')
    args = parser.parse_args()
    serve = functools.partial(QuietHandler, directory=args.root)
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), serve) as server, sync_playwright() as p:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/studio.html'
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-zygote', '--single-process'])
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, url)
        if args.baseline:
            baseline(page)
        else:
            instrument(page)
            timing_and_edits(page)
            stop_restart_and_suspend(page)
            repeats(page)
            custom_and_saved(page, url)
            backing_track(page)
        assert not errors, errors
        print(f"Chromium {browser.version}, {url}: no uncaught page exceptions")
        browser.close()
        server.shutdown()


if __name__ == '__main__':
    main()
