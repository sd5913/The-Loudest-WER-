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
    { id: 'cat', name: 'Orange Cat', kind: 'Cat', role: 'The bright little melody', asset: 'cat', sampleId: 'cat', color: '#ff9a55', light: '#ffd174', dark: '#a84d3c', wave: 'triangle', base: 523.25, emoji: '🐈', theme: 'pumpkin' },
    { id: 'ghost-cat', name: 'White Cat', kind: 'Cat', role: 'A soft, floaty echo', asset: 'cat', sampleId: 'cat', color: '#d6d5ff', light: '#fff0ff', dark: '#7575b0', wave: 'sine', base: 392, emoji: '✧', theme: 'ghost' },
    { id: 'bat-cat', name: 'Mystery Cat', kind: 'Cat', role: 'A bouncy midnight beat', asset: 'cat', sampleId: 'cat', color: '#a084e8', light: '#d6b4ff', dark: '#503774', wave: 'square', base: 783.99, emoji: '🐈‍⬛', theme: 'bat' }
  ];
  window.WERStore = {
    starters,
    getPets: () => read('pets', []),
    savePet(pet) { const pets = this.getPets().filter(item => item.id !== pet.id); pets.push(pet); return write('pets', pets); },
    getOwned: () => read('owned', []),
    adopt(id) { const owned = this.getOwned(); if (!owned.includes(id)) owned.push(id); return write('owned', owned); },
    getSongs: () => read('songs', []),
    saveSong(song) { const songs = this.getSongs(); songs.unshift(song); return write('songs', songs.slice(0, 40)); },
    removeSong(id) { return write('songs', this.getSongs().filter(song => song.id !== id)); },
    getScenes: () => read('scenes', []),
    saveScene(scene) { return write('scenes', [...this.getScenes().filter(item => item.id !== scene.id), scene]); },
    removeScene(id) { return write('scenes', this.getScenes().filter(scene => scene.id !== id)); },
    getSelectedScene: () => read('selectedScene', 'night'),
    saveSelectedScene(id) { return write('selectedScene', id); },
    getMode: () => read('mode', 'auto'),
    saveMode(mode) { return write('mode', mode); }
  };
})();
