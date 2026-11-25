const meowStyles = {
 mellow: {tempo: 84, key: 'Am', chords: ['Am', 'F', 'C', 'Am'], beats: [0, 3, 6, 8, 11, 14]},
 bright: {tempo: 122, key: 'C', chords: ['C', 'G', 'F', 'C'], beats: [0, 2, 4, 7, 8, 10, 12, 14]}
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
 const pitches = [.2, .35, .5, .65, .8].map(center => measureMeowPitch(samples, buffer.sampleRate, center));
 const voiced = pitches.filter(pitch => pitch !== null).sort((a, b) => a - b);
 const root = voiced[Math.floor(voiced.length / 2)] ?? null;
 const fallback = [7, 5, 4, 5, 6];
 const motif = pitches.map((pitch, i) => {
  if (pitch === null || voiced.length < 2) return fallback[i];
  return clamp(7 - Math.round(6 * Math.log2(pitch / root)), 2, 8);
 });
 const notes = {};
 for (let section = 0; section < sections; section++) {
  style.beats.forEach((beat, i) => {
   notes[section * 16 + beat] = i === style.beats.length - 1 ? 7 : motif[(i + section) % motif.length];
  });
 }
 return {notes, root};
}

$('#generateMeowRemix').addEventListener('click', () => {
 const pet = pets.find(item => item.id === selected);
 const buffer = pet && customBuffers.get(pet.id);
 if (!buffer) {
  notify('Upload or record a short call for this pet first.');
  return;
 }
 const style = meowStyles[$('#meowStyle').value];
 const {notes, root} = makeMeowArrangement(buffer, style, songLength);
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
  pitch: 0, clipRepeats: 1, repeat: 'loop', muted: false
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
