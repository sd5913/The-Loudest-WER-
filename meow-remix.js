const meowStyles = {
 mellow: {tempo: 84, key: 'Am', chords: ['Am', 'F', 'C', 'Am'], beats: [0, 2, 3, 5, 7, 8, 10, 12, 14], hook: [7, 5, 4, 3, 5, 7, 4, 5, 7], slice: .22},
 bright: {tempo: 122, key: 'C', chords: ['C', 'G', 'F', 'C'], beats: [0, 1, 2, 4, 5, 7, 8, 9, 10, 12, 13, 15], hook: [7, 5, 3, 1, 3, 5, 4, 2, 4, 3, 5, 7], slice: .16}
};

function measureMeowPitch(samples, sampleRate, center) {
 const stride = Math.max(1, Math.floor(sampleRate / 10000));
 const rate = sampleRate / stride;
 const size = Math.min(Math.floor(samples.length / stride), Math.round(rate * .04));
 const start = Math.max(0, Math.min(samples.length - size * stride,
  Math.round(center * samples.length - size * stride / 2)));
 const first = Math.max(1, Math.floor(rate / 1400));
 const last = Math.min(Math.ceil(rate / 150), Math.floor(size / 2));
 if (last <= first) return null;
 const window = Array.from({length: size}, (_, i) => samples[start + i * stride]);
 const mean = window.reduce((sum, value) => sum + value, 0) / size;
 const scores = new Float32Array(last + 1);
 let best = 0;
 for (let lag = first; lag <= last; lag++) {
  let cross = 0, energyA = 0, energyB = 0;
  for (let i = 0; i < size - lag; i++) {
   const a = window[i] - mean, b = window[i + lag] - mean;
   cross += a * b;
   energyA += a * a;
   energyB += b * b;
  }
  if (Math.min(energyA, energyB) / (size - lag) < .000025) continue;
  scores[lag] = cross / Math.sqrt(energyA * energyB);
  best = Math.max(best, scores[lag]);
 }
 const threshold = Math.max(.65, best * .9);
 for (let lag = first + 1; lag < last; lag++) {
  if (scores[lag] >= threshold && scores[lag] >= scores[lag - 1] && scores[lag] > scores[lag + 1]) {
   return rate / lag;
  }
 }
 return null;
}

function makeMeowArrangement(buffer, style, sections) {
 const samples = buffer.getChannelData(0);
 const length = Math.min(samples.length, Math.round(buffer.sampleRate * style.slice));
 const hop = Math.max(1, Math.round(buffer.sampleRate * .035));
 let loudest = {start: 0, energy: -1}, voiced = null;
 for (let start = 0; start <= samples.length - length; start += hop) {
  let energy = 0;
  for (let i = start; i < start + length; i += 4) energy += samples[i] ** 2;
  const pitch = measureMeowPitch(samples, buffer.sampleRate, (start + length / 2) / samples.length);
  if (energy > loudest.energy) loudest = {start, energy};
  if (pitch && (!voiced || energy > voiced.energy)) voiced = {start, energy, pitch};
 }
 const slice = voiced || loudest;
 const notes = {};
 for (let section = 0; section < sections; section++) {
  style.beats.forEach((beat, i) => {
   notes[section * 16 + beat] = style.hook[i];
  });
 }
 return {notes, root: voiced?.pitch, clipStart: slice.start / samples.length,
  clipEnd: (slice.start + length) / samples.length};
}

$('#generateMeowRemix').addEventListener('click', () => {
 const pet = pets.find(item => item.id === selected);
 const buffer = pet && customBuffers.get(pet.id);
 if (!buffer) {
  notify('Upload or record a short call for this pet first.');
  return;
 }
 const style = meowStyles[$('#meowStyle').value];
 const {notes, root, clipStart, clipEnd} = makeMeowArrangement(buffer, style, songLength);
 if (playing) $('#stop').click();
 meter = '4/4';
 musicKey = style.key;
 $('#tempo').value = style.tempo;
 chordPattern = [...style.chords, ...style.chords];
 chordEnabled = true;
 $('#meowBacking').checked = true;
 Object.assign(pet, {
  notes, steps: Object.keys(notes).map(Number), remixPitch: root || pet.base || 440,
  tone: 'custom', source: 'voice', aiPerformance: 'voice',
  pitch: 0, clipStart, clipEnd, clipRepeats: 1, repeat: 'loop', muted: false
 });
 phrasePage = 0;
 focusBeat = 0;
 composerMode = 'melody';
 render();
 scheduleDraftSave();
 setStudioHint('Remix ready. Press Play together to hear your pet and its backing.');
});

$('#meowBacking').addEventListener('change', event => {
 chordEnabled = event.target.checked;
 scheduleDraftSave();
});
