/* Browser-only project data. Nothing here is sent to a server. */
(() => {
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(`loudestwer.${key}`)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(`loudestwer.${key}`, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const starters = [
    { id: 'cat', name: 'Orange Cat', kind: 'Cat', role: 'The bright little melody', asset: 'cat', sampleId: 'cat-meow', color: '#ff9a55', light: '#ffd174', dark: '#a84d3c', wave: 'triangle', base: 523.25, emoji: '🐈', theme: 'pumpkin' },
    { id: 'ghost-cat', name: 'White Cat', kind: 'Cat', role: 'A soft, floaty echo', asset: 'cat', sampleId: 'cat', color: '#d6d5ff', light: '#fff0ff', dark: '#7575b0', wave: 'sine', base: 392, emoji: '✧', theme: 'ghost' },
    { id: 'bat-cat', name: 'Mystery Cat', kind: 'Cat', role: 'A bouncy midnight beat', asset: 'cat', sampleId: 'cat', color: '#a084e8', light: '#d6b4ff', dark: '#503774', wave: 'square', base: 783.99, emoji: '🐈‍⬛', theme: 'bat' }
  ];
  // A first-listen trio. Each pet has its own editable track and sound source.
  const demoSong = {
    id: 'song-1793940787462', name: '虫儿飞 · 三只猫合奏练习', savedAt: '2026-11-06T00:00:00.000Z',
    tempo: 88, version: 3, template: 0, scene: 'night', selected: 'ghost-cat',
    meter: '4/4', musicKey: 'C', songLength: 2, chordEnabled: false,
    chordPattern: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
    pets: [
      { id: 'cat', name: 'Orange Cat', volume: 38, pitch: 0, tone: 'sample', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [5, 13, 21, 29], notes: {}, source: 'voice', instrument: 'piano' },
      { id: 'ghost-cat', name: 'White Cat', volume: 60, pitch: 0, tone: 'meow', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [0, 1, 2, 3, 4, 7, 10, 16, 17, 18, 19, 20, 23, 26], notes: { 0: 5, 1: 5, 2: 5, 3: 4, 4: 3, 7: 5, 10: 6, 16: 7, 17: 7, 18: 7, 19: 6, 20: 5, 23: 5, 26: 8 }, source: 'voice', instrument: 'piano' },
      { id: 'bat-cat', name: 'Mystery Cat', volume: 46, pitch: 0, tone: 'signature', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], notes: { 0: 7, 2: 5, 4: 3, 6: 5, 8: 7, 10: 5, 12: 3, 14: 5, 16: 7, 18: 5, 20: 3, 22: 5, 24: 7, 26: 6, 28: 3, 30: 8 }, source: 'instrument', instrument: 'guitar' }
    ]
  };
  window.WERStore = {
    starters,
    getPets: () => read('pets', []),
    savePet(pet) { const pets = this.getPets().filter(item => item.id !== pet.id); pets.push(pet); return write('pets', pets); },
    getOwned: () => read('owned', []),
    adopt(id) { const owned = this.getOwned(); if (!owned.includes(id)) owned.push(id); return write('owned', owned); },
    getSongs() {
      if (localStorage.getItem('loudestwer.songs') === null) {
        write('songs', [demoSong]);
        return [demoSong];
      }
      return read('songs', []);
    },
    saveSong(song) { const songs = this.getSongs().filter(item => item.id !== song.id); songs.unshift(song); return write('songs', songs.slice(0, 40)); },
    removeSong(id) { return write('songs', this.getSongs().filter(song => song.id !== id)); },
    getScenes: () => read('scenes', []),
    saveScene(scene) { return write('scenes', [...this.getScenes().filter(item => item.id !== scene.id), scene]); },
    removeScene(id) { return write('scenes', this.getScenes().filter(scene => scene.id !== id)); },
    getSelectedScene: () => read('selectedScene', 'night'),
    saveSelectedScene(id) { return write('selectedScene', id); },
    getStagePositions(sceneId) { return read('stagePositions', {})[sceneId] || {}; },
    saveStagePositions(sceneId, positions) { return write('stagePositions', { ...read('stagePositions', {}), [sceneId]: positions }); },
    getMode: () => read('mode', 'auto'),
    saveMode(mode) { return write('mode', mode); }
  };
})();
