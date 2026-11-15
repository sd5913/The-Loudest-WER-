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
    { id:'cat',name:'Gray Cat',kind:'Cat',role:'A playful low melody',asset:'gray-cat',sampleId:'cat-meow',sampleFile:'starter-cat.mp3',color:'#777487',light:'#b7b2c5',dark:'#454153',wave:'triangle',base:440,emoji:'☾',theme:'gray' },
    { id:'ghost-cat',name:'Dachshund',kind:'Dog',role:'A warm little bass',asset:'dachshund',sampleId:'dog',sampleFile:'starter-dachshund.mp3',color:'#ad7150',light:'#e4ac7d',dark:'#66483f',wave:'sine',base:329.63,emoji:'♡',theme:'dachshund' },
    { id:'bat-cat',name:'Samoyed',kind:'Dog',role:'A snowy sparkling note',asset:'samoyed',sampleId:'dog',sampleFile:'starter-samoyed.mp3',color:'#e9e2de',light:'#fff9ed',dark:'#9b91a8',wave:'triangle',base:587.33,emoji:'✦',theme:'samoyed' }
  ];
  // Additional bundled pixel pets. Original starter IDs remain unchanged for old songs.
  const defaultPets = [
    {id:'hamster',name:'Hamster',kind:'Hamster',role:'A tiny bright pulse',asset:'hamster',color:'#c99467',light:'#f4d1a7',dark:'#815a4d',wave:'triangle',base:659.25,emoji:'✿'},
    {id:'sea-otter',name:'Sea Otter',kind:'Otter',role:'A gentle rolling note',asset:'sea-otter',color:'#aa8068',light:'#e8bd9d',dark:'#634b53',wave:'sine',base:392,emoji:'≈'}

  ];
  // A first-listen trio. Each pet has its own editable track and sound source.
  const demoSong = {
    id: 'song-1793940787462', name: '虫儿飞 · 三位伙伴合奏练习', savedAt: '2026-11-06T00:00:00.000Z',
    tempo: 88, version: 3, template: 0, scene: 'night', selected: 'ghost-cat',
    meter: '4/4', musicKey: 'C', songLength: 2, chordEnabled: false,
    chordPattern: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
    pets: [
      { id: 'cat', name: 'Gray Cat', volume: 38, pitch: 0, tone: 'sample', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [5, 13, 21, 29], notes: {}, source: 'voice', instrument: 'piano' },
      { id: 'ghost-cat', name: 'Dachshund', volume: 60, pitch: 0, tone: 'sample', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [0, 1, 2, 3, 4, 7, 10, 16, 17, 18, 19, 20, 23, 26], notes: { 0: 5, 1: 5, 2: 5, 3: 4, 4: 3, 7: 5, 10: 6, 16: 7, 17: 7, 18: 7, 19: 6, 20: 5, 23: 5, 26: 8 }, source: 'voice', instrument: 'piano' },
      { id: 'bat-cat', name: 'Samoyed', volume: 46, pitch: 0, tone: 'signature', strength: 70, echo: 0, repeat: 'loop', muted: false, steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], notes: { 0: 7, 2: 5, 4: 3, 6: 5, 8: 7, 10: 5, 12: 3, 14: 5, 16: 7, 18: 5, 20: 3, 22: 5, 24: 7, 26: 6, 28: 3, 30: 8 }, source: 'instrument', instrument: 'guitar' }
    ]
  };
  window.WERStore = {
    starters,
    defaultPets,
    getPets: () => read('pets', []),
    savePet(pet) { const pets = this.getPets().filter(item => item.id !== pet.id); pets.push(pet); return write('pets', pets); },
    getOwned: () => [...new Set(read('owned', []).map(id => ({'gray-cat':'cat',dachshund:'ghost-cat',samoyed:'bat-cat'})[id] || id))],
    adopt(id) { const owned = this.getOwned(); if (!owned.includes(id)) owned.push(id); return write('owned', owned); },
    getSongs() {
      if (localStorage.getItem('loudestwer.songs') === null) {
        write('songs', [demoSong]);
        return [demoSong];
      }
      return read('songs', []);
    },
    saveSong(song) { const songs = this.getSongs().filter(item => item.id !== song.id); songs.unshift(song); return write('songs', songs.slice(0, 40)); },
    getDraft: () => read('draft', null),
    saveDraft: draft => write('draft', draft),
    clearDraft() { try { localStorage.removeItem('loudestwer.draft'); return true; } catch { return false; } },
    removeSong(id) { return write('songs', this.getSongs().filter(song => song.id !== id)); },
    getScenes: () => read('scenes', []),
    saveScene(scene) { return write('scenes', [...this.getScenes().filter(item => item.id !== scene.id), scene]); },
    removeScene(id) { return write('scenes', this.getScenes().filter(scene => scene.id !== id)); },
    getSelectedScene: () => read('selectedScene', 'night'),
    saveSelectedScene(id) { return write('selectedScene', id); },
    getStagePositions(sceneId) { return read('stagePositions', {})[sceneId] || {}; },
    saveStagePositions(sceneId, positions) { return write('stagePositions', { ...read('stagePositions', {}), [sceneId]: positions }); },
    getMode: () => ['auto','sunset','night','day'].includes(read('mode','auto')) ? read('mode','auto') : 'auto',
    saveMode(mode) { return write('mode', mode); },
    getStudioMode: () => read('studioMode', read('mode','auto') === 'advanced' ? 'advanced' : 'beginner'),
    saveStudioMode(mode) { return write('studioMode', mode); }
  };
})();
