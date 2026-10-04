const audioFile = document.getElementById('audio-file');
const audio = document.getElementById('audio-element');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const volumeControl = document.getElementById('volume');
const trackName = document.getElementById('track-name');
const playlistUI = document.getElementById('playlist');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

let playlist = [];
let currentIndex = -1;
let isShuffle = false;
let repeatMode = 'off';

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let animId = null;

function killCurrentAudio() {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
}

function initAudioEngine() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
    } catch (e) {
        console.warn("AudioContext setup warning:", e);
    }
}

audioFile.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const isFirstTime = playlist.length === 0;

    files.forEach(f => {
        playlist.push({
            name: f.name,
            url: URL.createObjectURL(f)
        });
    });

    renderPlaylist();

    if (isFirstTime && playlist.length > 0) {
        loadAndPlay(0);
    }
});

function renderPlaylist() {
    playlistUI.innerHTML = '';
    playlist.forEach((track, i) => {
        const li = document.createElement('li');
        
        li.innerHTML = `
            <i class="fa-solid fa-music"></i>
            <div class="title-window">
                <span class="song-title">${i + 1}. ${track.name}</span>
            </div>
        `;

        if (i === currentIndex) li.classList.add('active');

        li.onclick = () => {
            if (i === currentIndex && !audio.paused) return;
            loadAndPlay(i);
        };

        playlistUI.appendChild(li);
    });
}

function loadAndPlay(index) {
    if (index < 0 || index >= playlist.length) return;

    killCurrentAudio();

    currentIndex = index;
    const track = playlist[currentIndex];
    trackName.innerHTML = `<i class="fa-solid fa-compact-disc"></i> ${track.name}`;

    audio.src = track.url;
    audio.load();

    renderPlaylist();

    initAudioEngine();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    audio.play().then(() => {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        startVisualizer();
    }).catch(err => {
        console.log("Playback interrupted:", err);
    });
}

playBtn.onclick = () => {
    if (currentIndex === -1 && playlist.length > 0) {
        loadAndPlay(0);
        return;
    }
    if (!audio.src) return;

    initAudioEngine();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    audio.play().then(() => {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        startVisualizer();
    });
};

pauseBtn.onclick = () => {
    audio.pause();
    playBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
};

nextBtn.onclick = playNext;
prevBtn.onclick = playPrev;

function playNext() {
    if (!playlist.length) return;
    let nextIdx;
    if (isShuffle) {
        nextIdx = Math.floor(Math.random() * playlist.length);
    } else {
        nextIdx = (currentIndex + 1) % playlist.length;
    }
    loadAndPlay(nextIdx);
}

function playPrev() {
    if (!playlist.length) return;
    let prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    loadAndPlay(prevIdx);
}

audio.onended = () => {
    if (repeatMode === 'one') {
        loadAndPlay(currentIndex);
    } else if (repeatMode === 'all' || currentIndex < playlist.length - 1 || isShuffle) {
        playNext();
    } else {
        pauseBtn.onclick();
    }
};

shuffleBtn.onclick = () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    shuffleBtn.innerHTML = isShuffle ? '<i class="fa-solid fa-shuffle"></i> Shuffle: On' : '<i class="fa-solid fa-shuffle"></i> Shuffle: Off';
};

repeatBtn.onclick = () => {
    if (repeatMode === 'off') {
        repeatMode = 'all';
        repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Repeat: All';
        repeatBtn.classList.add('active');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Repeat: One';
        repeatBtn.classList.add('active');
    } else {
        repeatMode = 'off';
        repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Repeat: Off';
        repeatBtn.classList.remove('active');
    }
};

audio.ontimeupdate = () => {
    if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressBar.value = pct;
        currentTimeEl.textContent = formatTime(audio.currentTime);
        totalDurationEl.textContent = formatTime(audio.duration);
    }
};

progressBar.oninput = (e) => {
    if (audio.duration) {
        audio.currentTime = (e.target.value / 100) * audio.duration;
    }
};

volumeControl.oninput = (e) => {
    audio.volume = e.target.value;
};

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function startVisualizer() {
    if (!analyser) return;

    if (animId) cancelAnimationFrame(animId);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#090d16';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            const r = barHeight + (25 * (i / bufferLength));
            const g = 250 * (i / bufferLength);
            const b = 255;

            canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
            canvasCtx.fillRect(x, canvas.height - barHeight / 1.5, barWidth, barHeight / 1.5);
            x += barWidth + 1;
        }
    }
    draw();
}
