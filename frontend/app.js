'use strict';

// ── Command sender ──────────────────────────────────────────────────────────

async function cmd(action) {
  try {
    const res = await fetch(`/api/command/${action}`, { method: 'POST' });
    if (!res.ok) {
      const { detail } = await res.json();
      showToast(`Error: ${detail}`, true);
    } else {
      showToast(action.replace(/_/g, ' '));
    }
  } catch {
    showToast('Server unreachable', true);
  }
}

// ── Toast ───────────────────────────────────────────────────────────────────

let _toastTimer;

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ── Voice – Web Speech API (browser-side) ──────────────────────────────────

const VOICE_MAP = [
  ['play pause',   'play_pause'],
  ['volume up',    'volume_up'],
  ['volume down',  'volume_down'],
  ['full screen',  'fullscreen'],
  ['fullscreen',   'fullscreen'],
  ['play',         'play_pause'],
  ['pause',        'play_pause'],
  ['next',         'next'],
  ['skip',         'next'],
  ['previous',     'previous'],
  ['rewind',       'backward'],
  ['forward',      'forward'],
  ['louder',       'volume_up'],
  ['quieter',      'volume_down'],
  ['softer',       'volume_down'],
  ['mute',         'mute'],
  ['unmute',       'mute'],
  ['silence',      'mute'],
];

function textToCommand(text) {
  const lower = text.toLowerCase();
  for (const [phrase, action] of VOICE_MAP) {
    if (lower.includes(phrase)) return action;
  }
  return null;
}

// ── Voice – Whisper (server-side) ──────────────────────────────────────────

let _mediaRecorder = null;
let _chunks = [];

async function sendAudioToWhisper(blob) {
  setVoiceStatus('Transcribing…');
  const form = new FormData();
  form.append('audio', blob, 'voice.webm');
  try {
    const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      setVoiceStatus(data.detail || 'Server error', 'err');
    } else {
      const label = data.command
        ? `"${data.text}" → ${data.command.replace(/_/g, ' ')}`
        : `"${data.text}" (no command matched)`;
      setVoiceStatus(label, data.command ? 'ok' : '');
    }
  } catch {
    setVoiceStatus('Whisper request failed', 'err');
  }
}

// ── Combined voice button ───────────────────────────────────────────────────

const voiceBtn   = document.getElementById('voiceBtn');
const voiceLabel = document.getElementById('voiceLabel');
const statusEl   = document.getElementById('voiceStatus');
const whisperToggle = document.getElementById('whisperToggle');

let _recognition = null;
let _isListening = false;

function setVoiceStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = 'voice-status' + (cls ? ` ${cls}` : '');
}

function startBrowserVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setVoiceStatus('Web Speech API not supported in this browser', 'err');
    return;
  }

  _recognition = new SR();
  _recognition.lang = 'en-US';
  _recognition.interimResults = false;
  _recognition.maxAlternatives = 1;

  _recognition.onstart = () => {
    _isListening = true;
    voiceBtn.classList.add('listening');
    voiceLabel.textContent = 'Listening…';
    setVoiceStatus('Speak now');
  };

  _recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const action = textToCommand(text);
    if (action) {
      cmd(action);
      setVoiceStatus(`"${text}" → ${action.replace(/_/g, ' ')}`, 'ok');
    } else {
      setVoiceStatus(`"${text}" — no command matched`);
    }
  };

  _recognition.onerror = (e) => {
    setVoiceStatus(`Error: ${e.error}`, 'err');
    stopVoice();
  };

  _recognition.onend = () => stopVoice();

  _recognition.start();
}

function startWhisperVoice() {
  if (!navigator.mediaDevices) {
    setVoiceStatus('Microphone access unavailable (HTTPS required)', 'err');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    _chunks = [];
    _mediaRecorder = new MediaRecorder(stream);
    _mediaRecorder.ondataavailable = (e) => _chunks.push(e.data);
    _mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(_chunks, { type: 'audio/webm' });
      sendAudioToWhisper(blob);
    };
    _mediaRecorder.start();
    _isListening = true;
    voiceBtn.classList.add('listening');
    voiceLabel.textContent = 'Recording…';
    setVoiceStatus('Speak now — click again to stop');
  }).catch((err) => {
    setVoiceStatus(`Mic error: ${err.message}`, 'err');
  });
}

function stopVoice() {
  _isListening = false;
  voiceBtn.classList.remove('listening');
  voiceLabel.textContent = 'Voice Command';
  if (_recognition) { try { _recognition.stop(); } catch {} _recognition = null; }
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
}

voiceBtn.addEventListener('click', () => {
  if (_isListening) {
    stopVoice();
    setVoiceStatus('Say: play, pause, next, volume up…');
    return;
  }
  if (whisperToggle.checked) {
    startWhisperVoice();
  } else {
    startBrowserVoice();
  }
});

// ── Tabs ────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── TV (LG webOS) ───────────────────────────────────────────────────────────

async function tvCmd(action, inputId) {
  const url = inputId
    ? `/api/tv/command/${action}?input_id=${encodeURIComponent(inputId)}`
    : `/api/tv/command/${action}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(`TV: ${data.detail}`, true);
      setTvStatus(data.detail, 'err');
    } else {
      showToast(`TV: ${action.replace(/_/g, ' ')}`);
    }
  } catch {
    showToast('Server unreachable', true);
  }
}

async function pairTv() {
  const host = document.getElementById('tvIp').value.trim();
  const mac  = document.getElementById('tvMac').value.trim();
  if (!host) { setTvStatus('Enter the TV IP address first', 'err'); return; }

  setTvStatus('Connecting… accept the pairing prompt on your TV');
  try {
    const res = await fetch('/api/tv/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, mac }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTvStatus(data.detail, 'err');
    } else if (data.paired) {
      setTvStatus('Paired successfully!', 'ok');
      showToast('TV paired');
      loadInputs();
    } else {
      setTvStatus('Connected but no key received — try again', 'err');
    }
  } catch {
    setTvStatus('Server unreachable', 'err');
  }
}

async function loadInputs() {
  const list = document.getElementById('inputsList');
  list.innerHTML = '<span class="dim">Loading…</span>';
  try {
    const res = await fetch('/api/tv/inputs');
    const data = await res.json();
    if (!res.ok) {
      list.innerHTML = `<span class="dim">${data.detail}</span>`;
      return;
    }
    if (!data.inputs || data.inputs.length === 0) {
      list.innerHTML = '<span class="dim">No inputs found</span>';
      return;
    }
    list.innerHTML = '';
    data.inputs.forEach((inp) => {
      const btn = document.createElement('button');
      btn.className = 'btn-input' + (inp.connected ? ' active-input' : '');
      btn.textContent = inp.label || inp.id;
      btn.onclick = () => tvCmd('set_input', inp.id);
      list.appendChild(btn);
    });
  } catch {
    list.innerHTML = '<span class="dim">Failed to load inputs</span>';
  }
}

function tvButton(name) {
  return tvCmd(`button?name=${encodeURIComponent(name)}`);
}

async function launchApp(appId, btnEl) {
  const label = btnEl ? btnEl.textContent.trim() : appId;
  try {
    const res = await fetch(`/api/tv/command/launch_app?app_id=${encodeURIComponent(appId)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(`Error: ${data.detail}`, true);
      setTvStatus(data.detail, 'err');
    } else {
      showToast(`Opening ${label}`);
    }
  } catch {
    showToast('Server unreachable', true);
  }
}

function setTvStatus(text, cls = '') {
  const el = document.getElementById('tvStatus');
  el.textContent = text;
  el.className = 'voice-status' + (cls ? ` ${cls}` : '');
}

// Load saved TV config on startup
fetch('/api/tv/config').then((r) => r.json()).then((cfg) => {
  if (cfg.host) document.getElementById('tvIp').value = cfg.host;
  if (cfg.mac)  document.getElementById('tvMac').value = cfg.mac;
  if (cfg.paired) setTvStatus('TV paired — ready to use', 'ok');
}).catch(() => {});

// ── Keyboard shortcuts ──────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const map = {
    ' ':          'play_pause',
    'ArrowRight': 'forward',
    'ArrowLeft':  'backward',
    'ArrowUp':    'volume_up',
    'ArrowDown':  'volume_down',
    'm':          'mute',
    'f':          'fullscreen',
    'n':          'next',
    'p':          'previous',
  };
  if (map[e.key]) {
    e.preventDefault();
    cmd(map[e.key]);
  }
});
