const meowStyles = {
 mellow: {tempo: 84, key: 'Am', chords: ['Am', 'F', 'C', 'G', 'Am', 'C', 'F', 'Am'], beats: [0, 2, 3, 5, 7, 8, 10, 12, 14], motif: [7, 5, 4], slice: .22},
 bright: {tempo: 116, key: 'C', chords: ['C', 'G', 'Am', 'F', 'C', 'Am', 'G', 'C'], beats: [0, 1, 2, 4, 6, 7, 8, 10, 11, 12, 14], motif: [7, 5, 3], slice: .16}
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
 // Use the contour around the selected voice, including the attack and decay.
 const contour = [.1, .5, .9].map(point =>
  measureMeowPitch(samples, buffer.sampleRate, (slice.start + point * length) / samples.length));
 const reference = voiced?.pitch;
 const motif = style.motif.map((row, i) => {
  if (!reference || !contour[i]) return row;
  const rise = clamp(Math.round(6 * Math.log2(contour[i] / reference)), -2, 2);
  return clamp(row - rise, 1, 8);
 });
 const notes = {};
 for (let section = 0; section < sections; section++) {
  style.beats.forEach((beat, i) => {
   const last = i === style.beats.length - 1;
   const row = motif[i % motif.length];
   const answer = beat >= 8 ? (section > 0 ? -2 : 1) : 0;
   notes[section * 16 + beat] = last ? 7 : clamp(row + answer, 1, 8);
  });
 }
 return {notes, root: voiced?.pitch, clipStart: slice.start / samples.length,
  clipEnd: (slice.start + length) / samples.length};
}

const meowRemixStatus = $('#meowRemixStatus');
const playMeowRemix = $('#playMeowRemix');

playMeowRemix.addEventListener('click', () => $('#play').click());

$('#generateMeowRemix').addEventListener('click', () => {
 const pet = pets.find(item => item.id === selected);
 const buffer = pet && customBuffers.get(pet.id);
 if (!buffer) {
  playMeowRemix.hidden = true;
  meowRemixStatus.textContent = 'Upload or record a short call for this pet first.';
  return;
 }
 const styleName = $('#meowStyle').value;
 const style = meowStyles[styleName];
 const {notes, root, clipStart, clipEnd} = makeMeowArrangement(buffer, style, 2);
 if (playing) $('#stop').click();
 meter = '4/4';
 songLength = 2;
 musicKey = style.key;
 $('#tempo').value = style.tempo;
 chordPattern = [...style.chords];
 backingStyle = styleName;
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
 meowRemixStatus.textContent = `Song ready! ${pet.name} sings an eight-bar remix.`;
 playMeowRemix.hidden = false;
 notify('Meow song generated successfully');
});

$('#meowBacking').addEventListener('change', event => {
 chordEnabled = event.target.checked;
 scheduleDraftSave();
});
