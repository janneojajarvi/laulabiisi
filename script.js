window.melodyLibrary = [];

const urls = [
    "sessionSet01.js", "sessionSet02.js", "sessionSet03.js", "sessionSet04.js",
    "sessionSet05.js", "sessionSet06.js", "sessionSet07.js", "sessionSet08.js",
    "sessionSet09.js", "sessionSet10.js", "sessionSet11.js", "sessionSet12.js",
    "sessionSet13.js", "sessionSet14.js", "sessionSet15.js", "sessionSet16.js",
    "sessionSet17.js", "sessionSet18.js", "folkwikiSet1.js", "folkwikiSet2.js",
    "folkwikiSet3.js", "fsfolkdiktning01.js", "esavelmat_kansantanssit.js", 
    "esavelmat_kjs.js", "esavelmat_rs1.js", "esavelmat_rs2.js", "esavelmat_hs1.js",
    "esavelmat_ls1.js", "esavelmat_ls2.js", "esavelmat_ls3.js", "esavelmat_ls4.js",
    "suomitest3.js", "fsfolkdiktning02.js", "FinnishTunes.js", "FinnishTunes2.js", 
    "swedish2.js", "norway1.js", "extrasetti5.js"
];

let selectedDuration = "1";
let selectedAccidental = ""; 
let isDottedMode = false;
let synthControl;
let currentAbc;
let noteHistory = [];


let currentWarp = 1.0;

function changeTempo(modifier) {
    if (!synthControl) return;
    
    currentWarp *= modifier;
    // Pidetään tempo järkevissä rajoissa
    if (currentWarp < 0.3) currentWarp = 0.3;
    if (currentWarp > 2.0) currentWarp = 2.0;
    
    // Päivitetään ABCJS-soitin
    synthControl.setWarp(currentWarp * 100);
    
    // Päivitetään tekstinäyttö
    document.getElementById('current-tempo-display').innerText = 
        "Tempo: " + Math.round(currentWarp * 100) + "%";
}

// --- APUFUNKTIOT ---

function getPitchValue(acc, note, oct) {
    const basePitches = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    let p = basePitches[note.toUpperCase()];
    if (note === note.toLowerCase()) p += 12;
    if (oct) {
        for (let char of oct) {
            if (char === ',') p -= 12;
            if (char === "'") p += 12;
        }
    }
    if (acc === '^') p += 1;
    if (acc === '_') p -= 1;
    return p;
}

function getFingerprint(abc) {
    if (!abc) return "";
    abc = abc.replace(/[><]/g, " ");
    // Poistetaan kertausmerkit (:), hakatut sulut ([ ja ]) sekä koristenuottien merkit ({ ja })
// Tämä varmistaa, että regex lukee vain nuotit ja tahtiviivat
abc = abc.replace(/[:\[\]{}]/g, "");
    const keyMatch = abc.match(/^K:\s*([A-G][#b]?)\s*([A-Za-z]*)/m);
    let root = keyMatch ? keyMatch[1] : "C";
    let mode = keyMatch && keyMatch[2] ? keyMatch[2].toLowerCase() : "maj";

    const modeOffsets = {
        'maj': 0, 'major': 0, 'ion': 0, 'ionian': 0, 'mix': -1, 'mixolydian': -1,
        'lyd': 1, 'lydian': 1, 'dor': -2, 'dorian': -2, 'min': -3, 'minor': -3, 
        'm': -3, 'aeo': -3, 'aeolian': -3, 'phr': -4, 'phrygian': -4, 'loc': -5, 'locrian': -5
    };

    const circleOfFifths = {
        'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
        'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7
    };

    let sharpCount = (circleOfFifths[root] || 0) + (modeOffsets[mode] || 0);
    const sharpsOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const flatsOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    const keyRules = {};

    if (sharpCount > 0) {
        for (let i = 0; i < sharpCount; i++) keyRules[sharpsOrder[i]] = '^';
    } else if (sharpCount < 0) {
        for (let i = 0; i < Math.abs(sharpCount); i++) keyRules[flatsOrder[i]] = '_';
    }

    let clean = abc.replace(/^[A-Z]:.*/gm, "").replace(/"[^"]*"/g, "").replace(/\{[^}]*\}/g, "");
    const regex = /([|])|([\^_=]?)([A-Ga-gHh])([,']*)([0-9/]*)/g;
    
    let notes = [];
    let barAccidentals = {}; 
    let match;

    while ((match = regex.exec(clean)) !== null) {
        if (match[1] === '|') {
            barAccidentals = {}; 
            continue;
        }
        let acc = match[2];
        const note = match[3];
        const oct = match[4];
        const durStr = match[5];
        const noteName = note.toUpperCase();

        if (acc) {
            if (acc === "=") acc = "";
            barAccidentals[noteName] = acc;
        } else {
            acc = barAccidentals.hasOwnProperty(noteName) ? barAccidentals[noteName] : (keyRules[noteName] || "");
        }

        let pitch = getPitchValue(acc, note, oct);
        let duration = 1;
        if (durStr) {
            if (durStr.includes('/')) {
                let parts = durStr.split('/');
                duration = (parseFloat(parts[0]) || 1) / (parseFloat(parts[1]) || 2);
            } else {
                duration = parseFloat(durStr);
            }
        }
        notes.push({ pitch, duration });
    }

    if (notes.length < 2) return "";
    let fp = [];
    for (let i = 1; i < notes.length; i++) {
        let interval = notes[i].pitch - notes[i-1].pitch;
        let ratio = notes[i].duration / notes[i-1].duration;
        let durRatio = Number(ratio.toFixed(1));
        fp.push(`${interval}:${durRatio}`);
    }
    return "|" + fp.join("|") + "|";
}

function toggleManualEdit() {
    const textarea = document.getElementById('searchQuery');
    const btn = document.getElementById('manual-edit-btn');
    
    if (textarea.readOnly) {
        // Sallitaan vapaa kirjoitus
        textarea.readOnly = false;
        textarea.setAttribute('inputmode', 'text');
        textarea.style.backgroundColor = "#fffde7"; // Kellertävä tausta muokkaustilassa
        textarea.focus();
        btn.innerText = "✅";
    } else {
        // Palataan takaisin nappulasyöttöön
        textarea.readOnly = true;
        textarea.setAttribute('inputmode', 'none');
        textarea.style.backgroundColor = "white";
        btn.innerText = "✏️";
    }
}

// --- LATAUS JA HAKU ---

async function initApp() {
    const loaderBar = document.getElementById("loader-bar");
    const loaderPercent = document.getElementById("loader-percent");
    const loaderContainer = document.getElementById("loader-container");

    for (let i = 0; i < urls.length; i++) {
        try {
            const response = await fetch(urls[i]);
            const text = await response.text();
            const startIdx = text.indexOf('[');
            const endIdx = text.lastIndexOf(']');
            
            if (startIdx !== -1 && endIdx !== -1) {
                const data = new Function('return ' + text.substring(startIdx, endIdx + 1))();
                if (Array.isArray(data)) {
                    data.forEach(tune => {
                        if (tune.abc) {
                            tune.fingerprint = getFingerprint(tune.abc);
                            window.melodyLibrary.push(tune);
                        }
                    });
                }
            }
            const progress = Math.round(((i + 1) / urls.length) * 100);
            if (loaderBar) loaderBar.style.width = progress + "%";
            if (loaderPercent) loaderPercent.textContent = progress + "%";
        } catch (e) { console.error(e); }
    }
    if (loaderContainer) loaderContainer.style.display = 'none';
}

function handleSearch() {

    if (ABCJS.synth.supportsAudio()) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
    const abcEditor = document.getElementById('searchQuery');
    const input = abcEditor.value;
    const searchBtn = document.getElementById('search-btn');

    if (input.replace(/\s/g, "").length < 3) {
        alert("Kirjoita vähintään 3 nuottia ennen hakua.");
        return;
    }

    // Muutetaan napin teksti hetkeksi
    searchBtn.innerText = "Etsitään...";
    searchBtn.disabled = true;

    // Käytetään setTimeoutia, jotta "Etsitään..." ehtii piirtyä ennen raskasta hakua
    setTimeout(() => {
        let rawFP = getFingerprint(input);
        if (!rawFP) {
            searchBtn.innerText = "Hae kappaleita";
            searchBtn.disabled = false;
            return;
        }

        let searchIntervals = rawFP.split('|')
                                   .filter(x => x.length > 0)
                                   .map(x => x.split(':')[0])
                                   .join('|');

        const matches = window.melodyLibrary.filter(t => {
            if (!t.fingerprint) return false;
            let libIntervals = t.fingerprint.split('|')
                                           .filter(x => x.length > 0)
                                           .map(x => x.split(':')[0])
                                           .join('|');
            return libIntervals.includes(searchIntervals);
        });

        const list = document.getElementById('results-list');
        document.getElementById('match-count').innerText = matches.length;
        list.innerHTML = "";

        matches.slice(0, 50).forEach(tune => {
    const div = document.createElement('div');
    div.className = 'tune-card';

    let displayName = tune.name;
    const abc = tune.abc;

    // Apufunktio kentän poimimiseen (varmempi versio)
    function getAbcField(fieldTag) {
        const tag = "\n" + fieldTag + ":";
        const startIdx = abc.indexOf(tag);
        if (startIdx === -1) return null;

        let contentStart = startIdx + tag.length;
        let remaining = abc.substring(contentStart);
        
        // Etsitään loppukohta (joko oikea rivinvaihto tai \n-teksti)
        let endIdx = remaining.indexOf("\n");
        let altEndIdx = remaining.indexOf("\\n");
        let finalEnd;
        
        if (endIdx !== -1 && altEndIdx !== -1) finalEnd = Math.min(endIdx, altEndIdx);
        else finalEnd = (endIdx !== -1) ? endIdx : altEndIdx;

        let result = (finalEnd !== -1) ? remaining.substring(0, finalEnd) : remaining;
        return result.replace(/[\\"]/g, "").trim();
    }

    let metaParts = [];
    const nameUpper = tune.name.toUpperCase();

    // SÄÄNTÖ 1: VIA-alkuiset (aiempi sääntö)
    if (nameUpper.startsWith("VIA")) {
        const rVal = getAbcField("R");
        const sVal = getAbcField("S");
        if (rVal && rVal !== "-") metaParts.push(rVal);
        if (sVal && sVal !== "-") metaParts.push(sVal);
    } 
    // SÄÄNTÖ 2: kt1, rs1, rs2 -> M: ja O:
    else if (nameUpper.startsWith("KT1") || nameUpper.startsWith("RS1") || nameUpper.startsWith("RS2")) {
        const mVal = getAbcField("M");
        const oVal = getAbcField("O");
        if (mVal && mVal !== "-") metaParts.push(mVal);
        if (oVal && oVal !== "-") metaParts.push(oVal);
    }
    // SÄÄNTÖ 3: hs1 -> N: ja O:
    else if (nameUpper.startsWith("HS1")) {
        const nVal = getAbcField("N");
        const oVal = getAbcField("O");
        if (nVal && nVal !== "-") metaParts.push(nVal);
        if (oVal && oVal !== "-") metaParts.push(oVal);
    }
    // SÄÄNTÖ 4: ls1, ls2, ls3, ls4 -> "laulusävelmä" ja O:
    else if (/^LS[1-4]/.test(nameUpper)) {
        metaParts.push("laulusävelmä");
        const oVal = getAbcField("O");
        if (oVal && oVal !== "-") metaParts.push(oVal);
    }

    // Yhdistetään ja lisätään nimen perään
    if (metaParts.length > 0) {
        let combinedMeta = metaParts.join(", ");
        if (combinedMeta.length > 70) combinedMeta = combinedMeta.substring(0, 67) + "...";
        displayName += ` <span class="meta-info">(${combinedMeta})</span>`;
    }

    div.innerHTML = `<h3>${displayName}</h3>`;
    
    div.onclick = function() {
    currentAbc = tune.abc;
    
    if (synthControl) {
        synthControl.pause();
        // Emme nollaa tässä synthControlia, jotta temposäädin pysyy kytkettynä
    }
    
    const audioContainer = document.getElementById('audio-controls');
    audioContainer.innerHTML = "";
    audioContainer.style.display = 'block';

    const abcWithTempo = tune.abc.includes("Q:") ? tune.abc : "Q:100\n" + tune.abc;
    
    // POISTA 'const' tästä alta, jotta se tallentuu globaaliin visualObj-muuttujaan
    visualObj = ABCJS.renderAbc("paper", abcWithTempo, { 
        responsive: 'resize',
        paddingbottom: 30 // Tärkeä tila huuliharpputablatureille [cite: 2026-03-22]
    })[0];
    
    if (ABCJS.synth.supportsAudio()) {
        const synth = new ABCJS.synth.CreateSynth();
        
        synth.init({ 
            visualObj: visualObj,
            audioContext: new (window.AudioContext || window.webkitAudioContext)() 
        })
        .then(function() {
            // Käytetään globaalia synthControlia
            if (!synthControl) {
                synthControl = new ABCJS.synth.SynthController();
            }
            
            synthControl.load("#audio-controls", null, {
                displayRestart: true,
                displayPlay: true,
                displayProgress: true,
                displayWarp: true
            });
            
            // Haetaan nykyinen tempo liukusäätimestä
            const currentBpm = parseInt(document.getElementById('tempoRange').value) || 100;
            return synthControl.setTune(visualObj, false, { bpm: currentBpm });
        })
        .catch(function(error) {
            console.warn("Audio-ongelma:", error);
        });
    }
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
};
            list.appendChild(div);
        });

        // Palautetaan nappi ennalleen
        searchBtn.innerText = "Hae kappaleita";
        searchBtn.disabled = false;
    }, 50);
}

// --- TAPAHTUMAT ---

let audioContext;
let analyser;
let micStream;
let isPitchActive = false;
let lastDetectedNote = null;
let isSilent = true;
let visualObj; // Globaali muuttuja temposäädintä varten


document.addEventListener('DOMContentLoaded', () => {
    initApp();
    
    const abcEditor = document.getElementById('searchQuery');
    const tempoRange = document.getElementById('tempoRange');
    const tempoDisplay = document.getElementById('tempoDisplay');

    // 1. Temposäätimen logiikka
    if (tempoRange) {
        tempoRange.oninput = () => {
            const newBpm = tempoRange.value;
            if (tempoDisplay) tempoDisplay.innerText = newBpm;
            
            if (synthControl && visualObj) {
                synthControl.setTune(visualObj, false, { bpm: parseInt(newBpm) })
                    .then(() => console.log("Tempo päivitetty: " + newBpm))
                    .catch(err => console.warn("Tempon päivitysvirhe:", err));
            }
        };
    }

    // 2. Esikatselun päivitys
    if (abcEditor) {
        abcEditor.addEventListener('input', () => {
            ABCJS.renderAbc("search-preview", "L:1/4\nM:none\n" + abcEditor.value, { 
                responsive: 'resize', 
                scale: 0.7 
            });
        });
    }

    // 3. Kesto-napit
    document.querySelectorAll('.dur-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDuration = btn.getAttribute('data-dur');
        });
    });

    // 4. Piste-nappi
    const dotBtn = document.getElementById('dot-btn');
    if (dotBtn) {
        dotBtn.addEventListener('click', (e) => {
            isDottedMode = !isDottedMode;
            e.target.classList.toggle('active', isDottedMode);
        });
    }

    // 5. Etumerkki-napit
    document.querySelectorAll('.acc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedAccidental = btn.classList.contains('active') ? "" : btn.getAttribute('data-acc');
            document.querySelectorAll('.acc-btn').forEach(b => b.classList.remove('active'));
            if (selectedAccidental) btn.classList.add('active');
        });
    });

    // 6. Nuotti-napit
    document.querySelectorAll('.note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const note = btn.getAttribute('data-note');
            let dur = selectedDuration;
            
            if (isDottedMode && note !== 'z') {
                if (selectedDuration === "1") dur = "3/2";
                else if (selectedDuration === "2") dur = "3";
                else if (selectedDuration === "/2") dur = "3/4";
                else if (selectedDuration === "/4") dur = "3/8";
                isDottedMode = false;
                if (dotBtn) dotBtn.classList.remove('active');
            } else if (selectedDuration === "1") {
                dur = "";
            }

            const noteString = selectedAccidental + note + dur + " ";
            const start = abcEditor.selectionStart;
            const end = abcEditor.selectionEnd;
            
            abcEditor.value = abcEditor.value.slice(0, start) + noteString + abcEditor.value.slice(end);
            abcEditor.selectionStart = abcEditor.selectionEnd = start + noteString.length;
            
            selectedAccidental = "";
            document.querySelectorAll('.acc-btn').forEach(b => b.classList.remove('active'));
            abcEditor.focus();

            ABCJS.renderAbc("search-preview", "L:1/4\nM:none\n" + abcEditor.value, { 
                responsive: 'resize', 
                scale: 0.7 
            });
        });
    });

    // 7. Hae-nappi
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            handleSearch();
        });
    }

    // 8. Backspace-painike
    const backspaceBtn = document.getElementById('backspace-btn');
    if (backspaceBtn) {
        backspaceBtn.addEventListener('click', () => {
            const start = abcEditor.selectionStart;
            const end = abcEditor.selectionEnd;
            const value = abcEditor.value;

            if (start === end && start > 0) {
                abcEditor.value = value.slice(0, start - 1) + value.slice(end);
                abcEditor.selectionStart = abcEditor.selectionEnd = start - 1;
            } else if (start !== end) {
                abcEditor.value = value.slice(0, start) + value.slice(end);
                abcEditor.selectionStart = abcEditor.selectionEnd = start;
            }

            ABCJS.renderAbc("search-preview", "L:1/4\nM:none\n" + abcEditor.value, { 
                responsive: 'resize', 
                scale: 0.7 
            });
            abcEditor.focus();
        });
    }
    
    // 9. Tyhjennys
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            abcEditor.value = "";
            document.getElementById('results-list').innerHTML = "";
            document.getElementById('match-count').innerText = "0";
            ABCJS.renderAbc("search-preview", ""); 
        });
    }
    




    
    
}); // Tämä sulkee DOMContentLoaded-funktion oikein

    // --- HYRÄILYTUNNISTUS (PITCH DETECTION) ---
// Taajuus -> MIDI-nuotti -> ABC-nuotti
function freqToAbc(freq) {
    if (!freq || freq < 50) return null;
    
    const midi = Math.round(12 * (Math.log(freq / 440) / Math.log(2)) + 69);
    
    // MIDI-arvot modulo 12: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=Bb, 11=B
    const noteInOctave = midi % 12;

    // Sallitut nuotit (C-duuri: C, D, E, F, G, A, B)
    // Nämä vastaavat modulo-arvoja: 0, 2, 4, 5, 7, 9, 11
    const allowedNotes = [0, 2, 4, 5, 7, 9, 11];

    // Jos nuotti ei ole C-duurissa, etsitään lähin sallittu nuotti
    let finalMidi = midi;
    if (!allowedNotes.includes(noteInOctave)) {
        // Yksinkertaisuuden vuoksi: jos ei löydy, palautetaan null (eli ei lisätä nuottia)
        // Tai vaihtoehtoisesti voitaisiin "pyöristää" lähimpään, mutta null on siistimpi hyräilyssä.
        return null; 
    }

    const notes = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = notes[noteInOctave];

    if (octave === 3) return noteName + ",";
    if (octave === 4) return noteName;
    if (octave === 5) return noteName.toLowerCase();
    if (octave === 6) return noteName.toLowerCase() + "'";
    
    return null;
}

// Autokorrelaatio-algoritmi taajuuden etsimiseen ääniaallosta
function autoCorrelate(buffer, sampleRate) {
    let SIZE = buffer.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Liian hiljainen

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    let buf = buffer.slice(r1, r2);
    SIZE = buf.length;

    let c = new Float32Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    let T0 = maxpos;
    return sampleRate / T0;
}

// --- HYRÄILYLOGIIKKA (Lisää nämä script.js loppuun) ---

async function togglePitchDetection() {
    const btn = document.getElementById('mic-btn');
    
    if (isPitchActive) {
        isPitchActive = false;
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
        }
        btn.innerText = "🎤 Hyräile nuotteja";
        btn.classList.remove('active-mic');
        document.getElementById('mic-feedback').innerText = "Mikrofoni pois päältä";
        return;
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream = stream;
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        isPitchActive = true;
        btn.innerText = "🛑 Lopeta kuuntelu";
        btn.classList.add('active-mic');
        detectLoop(); // Käynnistetään tunnistussilmukka
    } catch (err) {
        alert("Mikrofonia ei voitu aktivoida. Tarkista oikeudet.");
        console.error(err);
    }
}

function detectLoop() {
    if (!isPitchActive) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    
    const freq = autoCorrelate(buffer, audioContext.sampleRate);
    const feedbackEl = document.getElementById('mic-feedback');

    if (freq === -1) {
        // Hiljaisuus havaittu
        isSilent = true;
        if (feedbackEl) feedbackEl.innerText = "Kuunnellaan...";
    } else {
        const note = freqToAbc(freq);
        if (note) {
            console.log("Taajuus:", freq, "Nuotti:", note);
            if (feedbackEl) feedbackEl.innerText = "Kuultu nuotti: " + note;
            
            // Lisätään nuotti jos: vaihtui TAI tuli hiljaisuuden jälkeen
            if (note !== lastDetectedNote || isSilent) {
                addNoteFromMic(note);
                lastDetectedNote = note;
            }
            isSilent = false;
        }
    }
    // Jatkaa silmukkaa seuraavaan animaatioruutuun
    requestAnimationFrame(detectLoop);
}



function addNoteFromMic(note) {
    const abcEditor = document.getElementById('searchQuery');
    if (!abcEditor) return;

    noteHistory.push(note);

    // Pidetään historian pituus pienenä (esim. 2-3 nuottia)
    if (noteHistory.length > 2) {
        noteHistory.shift();
    }

    // Jos kaksi viimeisintä tunnistusta ovat sama nuotti
    if (noteHistory.length === 2 && noteHistory[0] === noteHistory[1]) {
        
        // Lisätään nuotti vain, jos se on eri kuin edellinen lisätty nuotti
        // TAI jos välissä on ollut hiljaisuus (isSilent)
        if (note !== lastDetectedNote || isSilent) {
            abcEditor.value += note + " ";
            
            // Päivitetään esikatselu ja laukaistaan hakuun tarvittavat muutokset
            abcEditor.dispatchEvent(new Event('input'));
            
            lastDetectedNote = note;
            isSilent = false; 
        }
        
        // Tyhjennetään historia, jotta emme lisää samaa nuottia heti uudestaan
        noteHistory = [];
    }
}
