const SOCIAL = [
  { label: "YouTube", url: "https://www.youtube.com/@ShiftZero" },
  { label: "Twitter", url: "https://twitter.com/shiftzero" },
  { label: "Facebook", url: "https://www.facebook.com/shiftzero" },
  { label: "Instagram", url: "https://www.instagram.com/shiftzero" },
  { label: "WhatsApp", url: "https://wa.me/" },
  { label: "Discord", url: "https://discord.gg/" },
];

const AVATARS = {
  Female: ["assets/avatar-f1.png", "assets/avatar-f2.png", "assets/avatar-f3.png"],
  Male: ["assets/avatar-m1.png", "assets/avatar-m2.png", "assets/avatar-m3.png"],
};

const CHAR_COUNT = 120;
const charIndexByVoice = {};

function assignUniqueCharacters(voices) {
  const sorted = [...voices].sort((a, b) => a.shortName.localeCompare(b.shortName));
  sorted.forEach((v, i) => {
    // unique image slot 1..120; beyond that still unique via wrap + offset style already different files
    charIndexByVoice[v.shortName] = (i % CHAR_COUNT) + 1;
  });
}

function avatarFor(voice) {
  const idx = charIndexByVoice[voice.shortName] || ((hashStr(voice.shortName) % CHAR_COUNT) + 1);
  return `assets/characters/char_${String(idx).padStart(3, "0")}.png`;
}

const NAME_POOLS = {
  en: {
    Female: ["Nova Lane", "Aurora Vee", "Lumen Sky", "Vera Soft", "Ivy Reed", "Clara Moss", "Echo Vale", "Mira Quinn"],
    Male: ["Orion Vale", "Cedar Knox", "Atlas Grey", "Jasper Holt", "River Dane", "Felix Grove", "Theo Marsh", "Kai Sterling"],
  },
  hi: {
    Female: ["Anvi Glow", "Ira Nest", "Myra Kite", "Saanvi Bloom", "Kiara Soft", "Aanya Drift"],
    Male: ["Arjun Drift", "Kabir North", "Reyansh Cove", "Vivaan Peak", "Ishaan Field", "Aarav Crest"],
  },
  ur: {
    Female: ["Zara Noor", "Hira Dawn", "Maham Soft", "Areeba Lilt", "Sana Vale"],
    Male: ["Hamza Crest", "Bilal North", "Omar Drift", "Zayan Peak", "Haris Grove"],
  },
  es: {
    Female: ["Luna Ríos", "Sofía Mar", "Camila Sol", "Valentina Sky", "Inés Coral"],
    Male: ["Mateo Sol", "Diego Mar", "Nicolás Ríos", "Andrés Cove", "Leo Coral"],
  },
  fr: {
    Female: ["Élise Clair", "Camille Vert", "Chloé Lune", "Inès Soft"],
    Male: ["Louis Clair", "Hugo Vert", "Noël Lune", "Arthur Soft"],
  },
  de: {
    Female: ["Lina Berg", "Mia Stein", "Greta Soft", "Anja Nord"],
    Male: ["Jonas Berg", "Felix Stein", "Leon Nord", "Otto Soft"],
  },
  ar: {
    Female: ["Layla Noor", "Hana Soft", "Amira Dawn", "Yasmin Vale"],
    Male: ["Omar Noor", "Yusuf Soft", "Karim Dawn", "Samir Vale"],
  },
  zh: {
    Female: ["Mei Lumen", "Lin Soft", "Yue Drift", "Qing Vale"],
    Male: ["Wei Lumen", "Jun Soft", "Hao Drift", "Chen Vale"],
  },
  ja: {
    Female: ["Aoi Soft", "Hana Drift", "Yuki Vale", "Mio Lumen"],
    Male: ["Haru Soft", "Sora Drift", "Ren Vale", "Kaito Lumen"],
  },
  pt: {
    Female: ["Lia Mar", "Ana Soft", "Beatriz Vale", "Clara Sol"],
    Male: ["Tiago Mar", "Pedro Soft", "Rafa Vale", "Nuno Sol"],
  },
  default: {
    Female: ["Lumen Soft", "Echo Bloom", "Aura Nest", "Vela Drift", "Nim Soft", "Pax Glow"],
    Male: ["Orbit Soft", "Nimbus Drift", "Quill Nest", "Forge Vale", "Axis Glow", "Bolt Crest"],
  },
};

const state = {
  voices: [],
  filtered: [],
  selectedVoice: "",
  studioLang: "all",
  online: false,
  outputDir: "",
  history: [],
  recent: [],
  favorites: [],
  pairs: [],
  pairPick: [],
  selectedPairId: "",
  brandMap: {},
  previewing: null,
  libPane: "exports",
  jobs: [],
  activeJobId: "",
  tab: "dashboard",
  podLinesOpen: false,
  batchKind: "studio",
  batchVoiceMode: "same",
  batchItems: [],
  maintAudioPath: "",
  silenceAudioPath: "",
  pendingSilencePath: "",
  previewPlaying: false,
  lines: [
    { speaker: "Host", gender: "Male", voice: "", text: "Welcome to ShiftVoice." },
    { speaker: "Guest", gender: "Female", voice: "", text: "This is a multi-speaker podcast demo." },
  ],
};

function dayPartGreeting() {
  const hour = new Date().getHours();
  // System clock: morning 5–11, afternoon 12–16, evening 17–20, night 21–4
  if (hour >= 5 && hour < 12) {
    return {
      hello: "Good morning, welcome",
      desc: "Good morning. Welcome to ShiftVoice by ShiftZero.",
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      hello: "Good afternoon, welcome",
      desc: "Good afternoon. Welcome to ShiftVoice by ShiftZero.",
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      hello: "Good evening, welcome",
      desc: "Good evening. Welcome to ShiftVoice by ShiftZero.",
    };
  }
  return {
    hello: "Good night, welcome",
    desc: "Good night. Welcome to ShiftVoice by ShiftZero.",
  };
}

function applyDayGreeting() {
  const g = dayPartGreeting();
  if ($("dashHello")) $("dashHello").textContent = g.hello;
  titles.dashboard = ["HOME / DASHBOARD", "Dashboard", g.desc];
  if (state.tab === "dashboard" && $("pageDesc")) $("pageDesc").textContent = g.desc;
}

const titles = {
  dashboard: ["HOME / DASHBOARD", "Dashboard", "Welcome to ShiftVoice by ShiftZero."],
  studio: ["CREATE / SINGLE VOICE", "Voice Studio", "Type your script, pick a branded voice, preview, then export MP3."],
  podcast: ["CREATE / MULTI-VOICE", "Podcast", "Type or upload Male/Female script. Auto stats, then start a background audio job."],
  jobs: ["QUEUE / LIVE", "Jobs", "Watch generation jobs — progress, ETA, search. Jobs keep running if you leave."],
  voices: ["EXPLORE / CATALOGUE", "Voices", "Free high-quality voices with unique ShiftVoice names. Save favorites and podcast pairs."],
  library: ["DATA / EXPORTS", "Library", "Exports, podcast pairs, and your saved voices."],
  batch: ["CREATE / BATCH", "Batch Studio", "Single-wise or podcast-wise — multi scripts into Jobs."],
  usage: ["DATA / USAGE", "Usage", "Chars, exports, batches, and job totals."],
  silence: ["TOOLS / SILENCE", "Silence", "Remove silence from generated ShiftVoice exports."],
  roadmap: ["ABOUT / ROADMAP", "Roadmap", "Shipped Batch & Usage — more features planned."],
  settings: ["SYSTEM / PREFERENCES", "Settings", "Output folder, What’s New, and update checks."],
  shiftzero: ["ABOUT / STUDIO", "About", "ShiftZero — the studio behind ShiftVoice."],
};

const $ = (id) => document.getElementById(id);

function apiReady() {
  return window.pywebview && window.pywebview.api;
}

async function waitApi(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (apiReady() && typeof window.pywebview.api.list_voices === "function") return window.pywebview.api;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error("Desktop bridge failed to start");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUserError(err) {
  const raw = String((err && err.message) || err || "");
  const low = raw.toLowerCase();
  if (
    /speech\.platform|bing\.com|trustedclienttoken|sec-ms-gec|https?:\/\/|edge_tts|edge-tts|microsoft|aiohttp|503|502|504|traceback/.test(low)
    || /\bedge\b|edge_tts|edge-tts/.test(low)
  ) {
    if (low.includes("503") || low.includes("unavailable")) {
      return "ShiftVoice voices are temporarily unavailable. Please try again shortly.";
    }
    return "ShiftVoice could not complete that request. Try again in a moment.";
  }
  return raw.length > 160 ? "ShiftVoice could not complete that request. Try again in a moment." : raw;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function splitLocale(locale) {
  const parts = String(locale || "").split("-").filter(Boolean);
  return { lang: (parts[0] || "").toLowerCase(), region: (parts[1] || "").toUpperCase() };
}

const _langNames = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "language" }); } catch { return null; }
})();
const _regionNames = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; }
})();

function languageLabel(lang) {
  if (!lang) return "World";
  try { return _langNames ? _langNames.of(lang) : lang.toUpperCase(); } catch { return lang.toUpperCase(); }
}

function regionLabel(region) {
  if (!region) return "";
  try { return _regionNames ? _regionNames.of(region) : region; } catch { return region; }
}

function buildBrandMap(voices) {
  const used = new Set();
  const map = {};
  const firsts = [
    "Nova","Lumen","Echo","Aura","Vela","Orbit","Nimbus","Quill","Forge","Axis","Bolt","Cedar","Atlas","River","Felix","Theo","Kai","Mira","Ivy","Clara","Vera","Orion","Jasper","Pax","Nim","Haze","Sol","Lux","Rune","Pike","Wren","Ash","Cove","Drift","Peak","Nest","Glow","Soft","Lane","Vale","Sky","Moss","Reed","Knox","Grey","Holt","Dane","Grove","Marsh","Sterling","Bloom","Crest","Field","Dawn","Lilt","North","Mar","Ríos","Clair","Berg","Stein","Noor","Mei","Lin","Yue","Aoi","Hana","Yuki","Lia","Ana","Beatriz","Tiago","Pedro",
  ];
  const lasts = [
    "Lane","Vee","Sky","Soft","Reed","Moss","Vale","Quinn","Knox","Grey","Holt","Dane","Grove","Marsh","Sterling","Glow","Bloom","Nest","Drift","Peak","Crest","Field","Dawn","Lilt","North","Cove","Mar","Sol","Coral","Clair","Vert","Lune","Berg","Stein","Nord","Noor","Lumen","Wave","Spark","Pulse","Tone","Chord","Note","Melody","Harmony","Rhythm","Tempo","Echo","Signal","Beam","Prism",
  ];
  const sorted = [...voices].sort((a, b) => a.shortName.localeCompare(b.shortName));
  sorted.forEach((v, i) => {
    let name;
    let n = 0;
    do {
      const f = firsts[(hashStr(v.shortName) + n + i) % firsts.length];
      const l = lasts[(hashStr(v.shortName + "x") + n * 3 + i * 2) % lasts.length];
      name = `${f} ${l}`;
      if (used.has(name)) name = `${f} ${l} ${n + 2}`;
      n += 1;
    } while (used.has(name) && n < 200);
    used.add(name);
    map[v.shortName] = name;
  });
  state.brandMap = map;
}

function brandName(voice) {
  if (!voice) return "Voice";
  if (state.brandMap[voice.shortName]) return state.brandMap[voice.shortName];
  return `Voice ${hashStr(voice.shortName) % 999}`;
}

function voiceMeta(voice) {
  const { lang, region } = splitLocale(voice.locale);
  return {
    display: brandName(voice),
    language: languageLabel(lang),
    country: regionLabel(region),
    langCode: lang,
    regionCode: region,
    gender: voice.gender || "Voice",
    avatar: avatarFor(voice),
  };
}

function voiceLabel(voice) {
  const meta = voiceMeta(voice);
  return `${meta.display} · ${meta.language}`;
}

function findVoice(id) {
  return state.voices.find((v) => v.shortName === id) || null;
}

function ratePitch() {
  const r = Number($("rate").value);
  const p = Number($("pitch").value);
  const rate = `${r >= 0 ? "+" : ""}${r}%`;
  const pitch = `${p >= 0 ? "+" : ""}${p}Hz`;
  $("rateVal").textContent = rate;
  $("pitchVal").textContent = pitch;
  return { rate, pitch, volume: "+0%" };
}

function updateStudioMeta() {
  const text = $("studioText").value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const rateFactor = 1 + Number($("rate").value) / 100;
  const seconds = Math.max(0, Math.round((words / (150 * Math.max(rateFactor, 0.4))) * 60));
  $("studioMeta").textContent = `${text.length.toLocaleString()} chars · ~${seconds}s`;
}

function setPodProgress(progress, label) {
  const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
  $("podProgressBar").style.width = `${pct}%`;
  $("podProgressPct").textContent = `${pct}%`;
  if (label) $("podProgressLabel").textContent = label;
}

function updatePodEta() {
  syncPodcastFromDom();
  updatePodStats();
}

function updatePodStats() {
  const lines = state.lines.filter((l) => (l.text || "").trim());
  const words = lines.reduce((n, line) => n + line.text.trim().split(/\s+/).length, 0);
  const speakers = new Set(lines.map((l) => (l.speaker || "").trim().toLowerCase()).filter(Boolean));
  const chars = lines.reduce((n, line) => n + line.text.length, 0);
  const rateFactor = 1 + Number(($("rate") && $("rate").value) || 0) / 100;
  const seconds = Math.max(0, Math.round((words / (150 * Math.max(rateFactor, 0.4))) * 60));
  const mins = (seconds / 60).toFixed(seconds >= 60 ? 1 : 0);
  if ($("podStatLines")) $("podStatLines").textContent = String(lines.length);
  if ($("podStatChars")) $("podStatChars").textContent = chars.toLocaleString();
  if ($("podStatSpeakers")) $("podStatSpeakers").textContent = String(speakers.size);
  if ($("podStatMinutes")) $("podStatMinutes").textContent = String(mins);
  if ($("podLineCountPill")) $("podLineCountPill").textContent = String(lines.length);
  if ($("podEta")) {
    $("podEta").textContent = lines.length
      ? `About ${mins} min audio · ${lines.length} lines · ${speakers.size} characters · job keeps running in Jobs`
      : "Type or upload a script to see lines, characters, and minutes.";
  }
}

function renderLibSavedVoices() {
  const box = $("libSavedVoices");
  if (!box) return;
  if (!state.favorites.length) {
    box.innerHTML = '<p class="muted">No saved voices yet.</p>';
    return;
  }
  box.innerHTML = state.favorites.map((id) => {
    const v = findVoice(id);
    if (!v) return `<button type="button" class="fav-item" data-recent="${escapeHtml(id)}"><div><strong>${escapeHtml(id)}</strong></div></button>`;
    const meta = voiceMeta(v);
    return `<button type="button" class="fav-item" data-recent="${escapeHtml(id)}">
      <img src="${escapeHtml(meta.avatar)}" alt="" />
      <div><strong>${escapeHtml(meta.display)}</strong><span>${escapeHtml(meta.language)} · ${escapeHtml(meta.gender)}</span></div>
    </button>`;
  }).join("");
}

function renderJobs(jobs) {
  const list = $("jobsList");
  const latest = $("jobsLatestBody");
  if (!list) return;
  if (!jobs.length) {
    list.innerHTML = '<div class="empty">No jobs yet. Generate from Studio or Podcast.</div>';
    if (latest) latest.textContent = "No jobs yet.";
    return;
  }
  const top = jobs[0];
  if (latest) {
    latest.innerHTML = `<strong>${escapeHtml(top.title || top.id)}</strong><br/>
      <span class="job-status ${escapeHtml(top.status || "")}">${escapeHtml(top.status || "")}</span>
      · ${Math.round((top.progress || 0) * 100)}% · ${escapeHtml(top.label || "")}
      ${top.etaMin != null ? ` · ~${top.etaMin} min audio` : ""}
      ${top.elapsedSec != null ? ` · ${top.elapsedSec}s elapsed` : ""}`;
  }
  list.innerHTML = jobs.map((job) => {
    const pct = Math.round((job.progress || 0) * 100);
    const done = job.status === "done";
    const playSrc = job.audio || job.url || "";
    const actions = done ? `<div class="job-actions">
      ${playSrc ? `<button type="button" class="btn ghost" data-job-act="play" data-src="${escapeHtml(playSrc)}" data-kind="${escapeHtml(job.kind || "")}">Play</button>` : ""}
      <button type="button" class="btn ghost" data-job-act="library">Open Library</button>
      <button type="button" class="btn ghost" data-job-act="folder" data-path="${escapeHtml(job.path || "")}">Open folder</button>
    </div>` : "";
    return `<div class="job-card" data-job="${escapeHtml(job.id)}">
      <div class="job-top">
        <div>
          <strong>${escapeHtml(job.title || job.id)}</strong>
          <div class="muted">${escapeHtml(job.kind || "")} · ${escapeHtml(job.id)} · ${job.lines || 0} lines · ${job.chars || 0} chars</div>
        </div>
        <span class="job-status ${escapeHtml(job.status || "")}">${escapeHtml(job.status || "")}</span>
      </div>
      <div class="job-bar"><i style="width:${pct}%"></i></div>
      <div class="muted" style="margin-top:6px">${escapeHtml(job.label || "")}${job.elapsedSec != null ? ` · ${job.elapsedSec}s` : ""}${job.path ? ` · saved` : ""}${job.error ? ` · ${escapeHtml(job.error)}` : ""}</div>
      ${actions}
    </div>`;
  }).join("");
}

async function refreshJobs() {
  try {
    const api = await waitApi();
    const q = ($("jobSearch") && $("jobSearch").value) || "";
    const result = await api.list_jobs(q);
    state.jobs = result.jobs || [];
    renderJobs(state.jobs);
  } catch (err) {
    console.error(err);
  }
}

function applyPodcastScriptText(value, fileName) {
  if ($("podcastScriptBox")) $("podcastScriptBox").value = value;
  if ($("importScriptText")) $("importScriptText").value = value;
  const result = parseImportedScript(value);
  if (result.invalidLines.length) {
    if ($("podcastHint")) {
      $("podcastHint").className = "hint err";
      $("podcastHint").textContent = `Fix line(s) ${result.invalidLines.slice(0, 5).join(", ")} · use Male: / Female:`;
    }
    return false;
  }
  if (!result.lines.length) return false;
  const locale = (findVoice(state.selectedVoice) || state.voices[0] || {}).locale || "en-US";
  let maleI = 0;
  let femaleI = 0;
  state.lines = result.lines.map((line) => {
    const pool = voicesByGender(line.gender);
    const idx = line.gender === "Female" ? femaleI++ : maleI++;
    const pick = pool[idx % Math.max(pool.length, 1)] || state.voices[0];
    return {
      gender: line.gender,
      speaker: uniqueSpeakerName(line.gender, locale, idx),
      text: line.text,
      voice: pick ? pick.shortName : "",
    };
  });
  // apply selected pair if any
  const pair = state.pairs.find((p) => p.id === state.selectedPairId);
  if (pair) {
    state.lines.forEach((line, i) => {
      line.voice = i % 2 === 0 ? pair.host : pair.guest;
    });
  }
  renderPodcast();
  updatePodStats();
  if ($("podcastFileLabel")) $("podcastFileLabel").textContent = fileName ? `Loaded · ${fileName}` : "Script parsed";
  if ($("podcastHint")) {
    $("podcastHint").className = "hint ok";
    $("podcastHint").textContent = `${state.lines.length} lines ready · ${new Set(state.lines.map((l) => l.speaker)).size} characters`;
  }
  return true;
}

function pushRecent(voiceId) {
  if (!voiceId) return;
  state.recent = [voiceId, ...state.recent.filter((v) => v !== voiceId)].slice(0, 6);
  renderRecent();
}

function renderRecent() {
  const box = $("recentVoices");
  if (!state.recent.length) {
    box.innerHTML = '<p class="muted">Previews show up here.</p>';
    return;
  }
  box.innerHTML = state.recent.map((id) => {
    const v = findVoice(id);
    if (!v) return "";
    return `<button type="button" class="recent-item" data-recent="${escapeHtml(id)}">${escapeHtml(voiceLabel(v))}</button>`;
  }).join("");
}

function setTab(tab) {
  state.tab = tab;
  if (tab === "dashboard") applyDayGreeting();
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
  const entry = titles[tab] || titles.dashboard;
  const [eye, title, desc] = entry;
  $("pageEyebrow").textContent = eye;
  $("pageTitle").textContent = title;
  $("pageDesc").textContent = desc;
  if (tab === "library") {
    refreshLibrary();
    renderLibPairs();
    renderLibSavedVoices();
  }
  if (tab === "jobs") refreshJobs();
  if (tab === "podcast") {
    renderPodcast();
    renderPairSelect();
    updatePodEta();
    updatePodStats();
  }
  if (tab === "voices") applyVoiceFilters();
  if (tab === "dashboard") refreshDashboard();
  if (tab === "batch") {
    renderBatchVoiceSelects();
    renderBatchList();
    updateBatchStats();
  }
  if (tab === "usage") refreshUsage();
  if (tab === "silence") refreshSilence();
}

function renderVoiceSelect() {
  const select = $("voiceSelect");
  const current = state.selectedVoice;
  const lang = state.studioLang || "all";
  const list = state.voices.filter((v) => lang === "all" || splitLocale(v.locale).lang === lang);
  select.innerHTML = '<option value="">Choose a voice…</option>';
  list.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.shortName;
    opt.textContent = voiceLabel(v);
    if (v.shortName === current) opt.selected = true;
    select.appendChild(opt);
  });
  if (current && !list.some((v) => v.shortName === current) && list[0]) {
    state.selectedVoice = list[0].shortName;
    select.value = state.selectedVoice;
  }
}

function renderStudioLang() {
  const langs = [...new Set(state.voices.map((v) => splitLocale(v.locale).lang).filter(Boolean))].sort();
  const sel = $("studioLang");
  if (!sel) return;
  const cur = state.studioLang || "all";
  sel.innerHTML = '<option value="all">All languages</option>';
  langs.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = languageLabel(l);
    sel.appendChild(opt);
  });
  sel.value = cur === "all" || langs.includes(cur) ? cur : "all";
}

function renderLangFilter() {
  const langs = [...new Set(state.voices.map((v) => splitLocale(v.locale).lang).filter(Boolean))].sort();
  const sel = $("langFilter");
  const cur = sel.value || "all";
  sel.innerHTML = '<option value="all">All languages</option>';
  langs.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = languageLabel(l);
    sel.appendChild(opt);
  });
  sel.value = langs.includes(cur) ? cur : "all";
}

function renderFavList() {
  const box = $("favList");
  const badge = $("favCountBadge");
  if (badge) badge.textContent = String(state.favorites.length);
  if (!box) return;
  if (!state.favorites.length) {
    box.innerHTML = '<p class="muted">Save voices you like — they appear here.</p>';
    return;
  }
  box.innerHTML = state.favorites.map((id) => {
    const v = findVoice(id);
    if (!v) {
      return `<button type="button" class="fav-item" data-recent="${escapeHtml(id)}">
        <div><strong>${escapeHtml(id)}</strong><span>Saved voice</span></div>
      </button>`;
    }
    const meta = voiceMeta(v);
    return `<button type="button" class="fav-item" data-recent="${escapeHtml(id)}">
      <img src="${escapeHtml(meta.avatar)}" alt="" />
      <div><strong>${escapeHtml(meta.display)}</strong><span>${escapeHtml(meta.language)} · ${escapeHtml(meta.gender)}</span></div>
    </button>`;
  }).join("");
}

function syncPairModeUi() {
  const mode = document.querySelector('input[name="pairMode"]:checked')?.value || "create";
  const sel = $("pairUpdateSelect");
  if (!sel) return;
  const showUpdate = mode === "update";
  sel.classList.toggle("hidden", !showUpdate);
  const cur = sel.value;
  sel.innerHTML = '<option value="">Choose pair…</option>';
  (state.pairs || []).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    const host = findVoice(p.host);
    const guest = findVoice(p.guest);
    const hostName = host ? voiceMeta(host).display : "Host";
    const guestName = guest ? voiceMeta(guest).display : "Guest";
    opt.textContent = `${p.name} (${hostName} + ${guestName})`;
    sel.appendChild(opt);
  });
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  else if (showUpdate && state.pairs[0]) sel.value = state.pairs[0].id;
  const pair = state.pairs.find((p) => p.id === sel.value);
  if (showUpdate && pair && $("pairName")) $("pairName").value = pair.name;
  if ($("btnSavePair")) {
    $("btnSavePair").textContent = showUpdate ? "Update pair" : "Create new pair";
  }
}

function renderPairPick() {
  const box = $("pairPickBox");
  if (!state.pairPick.length) {
    box.textContent = "None selected — click cards to pick 2";
    return;
  }
  box.innerHTML = state.pairPick.map((id, i) => {
    const v = findVoice(id);
    const role = i === 0 ? "Host" : "Guest";
    return `<div><strong>${role}:</strong> ${escapeHtml(v ? voiceMeta(v).display : id)}</div>`;
  }).join("");
}

function renderPairsList() {
  const box = $("pairsList");
  if (!state.pairs.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = state.pairs.map((p) => {
    const host = findVoice(p.host);
    const guest = findVoice(p.guest);
    return `<div class="pair-item">
      <div><strong>${escapeHtml(p.name)}</strong><br/><span class="muted">${escapeHtml(host ? voiceMeta(host).display : "Host")} + ${escapeHtml(guest ? voiceMeta(guest).display : "Guest")}</span></div>
      <button type="button" class="btn ghost" data-del-pair="${escapeHtml(p.id)}">✕</button>
    </div>`;
  }).join("");
}

function renderPairSelect() {
  const box = $("pairRadioList");
  if (!box) return;
  if (!state.pairs.length) {
    box.innerHTML = '<p class="muted">No saved pairs yet. Save two voices from Voices → Save for podcast.</p>';
    return;
  }
  box.innerHTML = state.pairs.map((p) => {
    const host = findVoice(p.host);
    const guest = findVoice(p.guest);
    const checked = state.selectedPairId === p.id ? "checked" : "";
    const hostImg = host ? voiceMeta(host).avatar : "";
    const guestImg = guest ? voiceMeta(guest).avatar : "";
    return `<label class="pair-radio">
      <input type="radio" name="podPair" value="${escapeHtml(p.id)}" ${checked} />
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <div class="pair-radio-row" style="margin-top:6px">
          ${hostImg ? `<img class="pair-radio-avatar" src="${escapeHtml(hostImg)}" alt="" />` : ""}
          ${guestImg ? `<img class="pair-radio-avatar" src="${escapeHtml(guestImg)}" alt="" />` : ""}
          <div class="muted">Host: ${escapeHtml(host ? voiceMeta(host).display : "—")} · Guest: ${escapeHtml(guest ? voiceMeta(guest).display : "—")}</div>
        </div>
      </div>
    </label>`;
  }).join("");
  if (!state.selectedPairId && state.pairs[0]) state.selectedPairId = state.pairs[0].id;
  const input = box.querySelector(`input[value="${CSS.escape(state.selectedPairId)}"]`);
  if (input) input.checked = true;
}

function renderLibPairs() {
  const box = $("libPairsList");
  if (!box) return;
  const q = (($("pairSearch") && $("pairSearch").value) || "").toLowerCase();
  const list = state.pairs.filter((p) => !q || String(p.name || "").toLowerCase().includes(q));
  if (!list.length) {
    box.innerHTML = '<div class="empty">No podcast pairs yet. Save a host + guest from Voices.</div>';
    return;
  }
  const voiceOpts = state.voices.map((v) => `<option value="${escapeHtml(v.shortName)}">${escapeHtml(voiceLabel(v))}</option>`).join("");
  box.innerHTML = list.map((p) => `<div class="pair-edit-card" data-pair-id="${escapeHtml(p.id)}">
    <input type="text" data-field="name" value="${escapeHtml(p.name)}" />
    <label class="field-label">Host voice</label>
    <select data-field="host">${voiceOpts}</select>
    <label class="field-label">Guest voice</label>
    <select data-field="guest">${voiceOpts}</select>
    <div class="btn-row tight">
      <button type="button" class="btn primary" data-act="save-pair">Save changes</button>
      <button type="button" class="btn ghost" data-act="use-pair">Use in Podcast</button>
      <button type="button" class="btn ghost" data-act="del-pair">Remove</button>
    </div>
  </div>`).join("");
  box.querySelectorAll(".pair-edit-card").forEach((card) => {
    const id = card.dataset.pairId;
    const pair = state.pairs.find((x) => x.id === id);
    if (!pair) return;
    card.querySelector('[data-field="host"]').value = pair.host;
    card.querySelector('[data-field="guest"]').value = pair.guest;
  });
}

function applyVoiceFilters() {
  const q = ($("voiceSearch").value || "").toLowerCase();
  const lang = $("langFilter").value;
  const gender = $("genderFilter").value;
  const scope = $("voiceScope").value;
  state.filtered = state.voices.filter((v) => {
    if (scope === "saved" && !state.favorites.includes(v.shortName)) return false;
    if (lang !== "all" && splitLocale(v.locale).lang !== lang) return false;
    if (gender !== "all" && (v.gender || "") !== gender) return false;
    const meta = voiceMeta(v);
    if (q && !`${meta.display} ${meta.language} ${meta.country} ${v.locale}`.toLowerCase().includes(q)) return false;
    return true;
  });

  $("railTotal").textContent = String(state.voices.length);
  $("railShown").textContent = String(state.filtered.length);
  $("railExports").textContent = String(state.history.length);
  const males = state.voices.filter((v) => v.gender === "Male").length;
  const females = state.voices.filter((v) => v.gender === "Female").length;
  $("railGenderTags").innerHTML = `
    <span class="tag">${males} Male</span>
    <span class="tag">${females} Female</span>
    <span class="tag">Free HQ</span>
    <span class="tag">ShiftVoice</span>`;

  const grid = $("voiceGrid");
  if (!state.filtered.length) {
    grid.innerHTML = '<div class="empty">No voices match your filters.</div>';
    return;
  }

  grid.innerHTML = state.filtered.slice(0, 240).map((v) => {
    const meta = voiceMeta(v);
    const active = v.shortName === state.selectedVoice ? " active" : "";
    const pairOn = state.pairPick.includes(v.shortName) ? " pair-selected" : "";
    const saved = state.favorites.includes(v.shortName);
    const previewing = state.previewing === v.shortName;
    return `<div class="voice-card${active}${pairOn}" data-voice="${escapeHtml(v.shortName)}">
      <div class="voice-card-top">
        <div class="avatar"><img src="${escapeHtml(meta.avatar)}" alt="" /></div>
        <div>
          <strong>${escapeHtml(meta.display)}</strong>
          <div class="sub">${escapeHtml(meta.language)}${meta.country ? ` · ${escapeHtml(meta.country)}` : ""}</div>
        </div>
      </div>
      <div class="voice-tags">
        <span class="tag">${escapeHtml(meta.language)}</span>
        ${meta.country ? `<span class="tag">${escapeHtml(meta.country)}</span>` : ""}
        <span class="tag">${escapeHtml(meta.gender)}</span>
        <span class="tag">HQ Free</span>
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" data-act="preview" ${previewing ? "disabled" : ""}>${previewing ? "Playing" : "Preview"}</button>
        <button type="button" class="btn ghost" data-act="save">${saved ? "Saved" : "Save"}</button>
        <button type="button" class="btn ghost" data-act="pair">Pair</button>
        <button type="button" class="btn primary" data-act="use">Use</button>
      </div>
      <div class="preview-slot${previewing ? " active" : ""}" data-preview-slot></div>
    </div>`;
  }).join("");
}

function voicesByGender(gender) {
  return state.voices.filter((v) => (v.gender || "").toLowerCase() === gender.toLowerCase());
}

function uniqueSpeakerName(gender, locale, index) {
  const firsts = gender === "Female"
    ? ["Mira", "Nova", "Lumen", "Ivy", "Clara", "Aura", "Vela", "Echo"]
    : ["Orion", "Atlas", "Cedar", "Kai", "Theo", "River", "Bolt", "Axis"];
  const lasts = ["Host", "Guest", "Lead", "Cast", "Voice", "Tone", "Spark", "Wave"];
  return `${firsts[index % firsts.length]} ${lasts[index % lasts.length]} ${index + 1}`;
}

function renderPodcast() {
  const box = $("podcastLines");
  if (!box) return;
  if ($("podLineCountPill")) $("podLineCountPill").textContent = String(state.lines.length);
  if ($("podLinesAdvanced")) {
    $("podLinesAdvanced").classList.toggle("hidden", !state.podLinesOpen);
  }
  if ($("btnTogglePodLines")) {
    $("btnTogglePodLines").textContent = state.podLinesOpen ? "Hide advanced lines" : "Show advanced lines";
  }
  if (!state.podLinesOpen) return;
  const opts = state.voices.map((v) => `<option value="${escapeHtml(v.shortName)}">${escapeHtml(voiceLabel(v))}</option>`).join("");
  box.innerHTML = state.lines.map((line, i) => `<div class="pod-line" data-i="${i}">
    <div>
      <input type="text" data-field="speaker" value="${escapeHtml(line.speaker || `Speaker ${i + 1}`)}" placeholder="Character name" />
      <select data-field="voice" style="margin-top:6px">${opts}</select>
    </div>
    <textarea data-field="text" rows="2">${escapeHtml(line.text || "")}</textarea>
    <button type="button" class="btn ghost" data-act="remove">✕</button>
  </div>`).join("");
  box.querySelectorAll(".pod-line").forEach((row) => {
    const i = Number(row.dataset.i);
    const sel = row.querySelector('select[data-field="voice"]');
    sel.value = state.lines[i].voice || state.selectedVoice || (state.voices[0] && state.voices[0].shortName) || "";
    state.lines[i].voice = sel.value;
  });
}

function syncPodcastFromDom() {
  const box = $("podcastLines");
  if (!box) return;
  box.querySelectorAll(".pod-line").forEach((row) => {
    const i = Number(row.dataset.i);
    state.lines[i] = {
      speaker: row.querySelector('[data-field="speaker"]').value,
      voice: row.querySelector('[data-field="voice"]').value,
      text: row.querySelector('[data-field="text"]').value,
      gender: state.lines[i].gender || "",
    };
  });
}

function parseImportedScript(value) {
  const parsedLines = [];
  const invalidLines = [];
  String(value || "").split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const separator = line.indexOf(":");
    const speakerRaw = separator > 0 ? line.slice(0, separator).trim() : "";
    const dialogue = separator > 0 ? line.slice(separator + 1).trim() : "";
    const genderKey = speakerRaw.toLowerCase();
    const isGender = genderKey === "male" || genderKey === "female";
    if (!speakerRaw || !dialogue || speakerRaw.length > 80 || !isGender) {
      invalidLines.push(index + 1);
      return;
    }
    parsedLines.push({
      gender: genderKey === "female" ? "Female" : "Male",
      text: dialogue,
    });
  });
  return { lines: parsedLines, invalidLines };
}

function updateImportFeedback() {
  const value = $("importScriptText").value;
  const result = parseImportedScript(value);
  const feedback = $("importFeedback");
  const label = feedback.querySelector("span");
  const apply = $("btnApplyImport");
  feedback.className = "import-feedback";
  if (!value.trim()) {
    label.textContent = "Waiting for your script";
    apply.disabled = true;
    $("importButtonLabel").textContent = "Import script";
  } else if (result.invalidLines.length) {
    feedback.classList.add("invalid");
    label.textContent = `Fix line${result.invalidLines.length === 1 ? "" : "s"} ${result.invalidLines.slice(0, 5).join(", ")} · use Male: / Female:`;
    apply.disabled = true;
    $("importButtonLabel").textContent = "Fix script first";
  } else {
    feedback.classList.add("valid");
    label.textContent = `${result.lines.length} lines ready · auto names + voices`;
    apply.disabled = !result.lines.length;
    $("importButtonLabel").textContent = result.lines.length ? `Import ${result.lines.length} lines` : "Import script";
  }
  return result;
}

function openImportModal() {
  $("importModal").classList.remove("hidden");
  $("importModal").setAttribute("aria-hidden", "false");
  updateImportFeedback();
  requestAnimationFrame(() => $("importScriptText").focus());
}
function closeImportModal() {
  $("importModal").classList.add("hidden");
  $("importModal").setAttribute("aria-hidden", "true");
}
function openHelpModal() {
  $("helpModal").classList.remove("hidden");
  $("helpModal").setAttribute("aria-hidden", "false");
}
function closeHelpModal() {
  $("helpModal").classList.add("hidden");
  $("helpModal").setAttribute("aria-hidden", "true");
}

function applyImportedScript() {
  const result = updateImportFeedback();
  if (!result.lines.length || result.invalidLines.length) return;
  const locale = (findVoice(state.selectedVoice) || state.voices[0] || {}).locale || "en-US";
  let maleI = 0;
  let femaleI = 0;
  state.lines = result.lines.map((line) => {
    const pool = voicesByGender(line.gender);
    const idx = line.gender === "Female" ? femaleI++ : maleI++;
    const pick = pool[idx % Math.max(pool.length, 1)] || state.voices[0];
    return {
      gender: line.gender,
      speaker: uniqueSpeakerName(line.gender, locale, idx),
      text: line.text,
      voice: pick ? pick.shortName : "",
    };
  });
  renderPodcast();
  updatePodEta();
  setPodProgress(0, `${result.lines.length} imported · unique names assigned`);
  closeImportModal();
  setTab("podcast");
}

async function loadVoices(force = false) {
  const api = await waitApi();
  const result = await api.list_voices(force);
  if (!result.ok) throw new Error(result.message || "Could not load voices");
  state.voices = result.voices || [];
  buildBrandMap(state.voices);
  assignUniqueCharacters(state.voices);
  if (!state.selectedVoice) {
    const preferred = state.voices.find((v) => (v.locale || "").startsWith("en-") && v.gender === "Female") || state.voices[0];
    state.selectedVoice = preferred ? preferred.shortName : "";
  }
  if (state.lines.some((l) => !l.voice)) {
    state.lines.forEach((line, i) => {
      if (line.voice) return;
      const gender = i % 2 === 1 ? "Female" : "Male";
      const pool = voicesByGender(gender);
      line.voice = (pool[i % Math.max(pool.length, 1)] || state.voices[0] || {}).shortName || "";
      line.gender = gender;
    });
  }
  $("voiceCountPill").textContent = `${state.voices.length} voices`;
  $("statVoices").textContent = String(state.voices.length);
  renderVoiceSelect();
  renderStudioLang();
  renderLangFilter();
  applyVoiceFilters();
  renderPodcast();
  renderRecent();
  renderFavList();
  renderPairsList();
  renderPairSelect();
  renderLibPairs();
  syncPairModeUi();
}

async function checkOnline() {
  try {
    const api = await waitApi();
    const result = await api.check_internet();
    state.online = Boolean(result.online);
  } catch {
    state.online = false;
  }
  $("onlineDot").className = `dot ${state.online ? "on" : "off"}`;
  $("onlineLabel").textContent = state.online ? "Online · ready" : "Offline";
}

async function loadSettings() {
  const api = await waitApi();
  const result = await api.get_settings();
  state.outputDir = result.outputDir || "";
  $("outputPath").textContent = state.outputDir;
}

async function loadLibrary() {
  const api = await waitApi();
  const result = await api.get_library();
  state.favorites = result.favorites || [];
  state.pairs = result.pairs || [];
  if (!state.selectedPairId && state.pairs[0]) state.selectedPairId = state.pairs[0].id;
  renderFavList();
  renderPairsList();
  renderPairSelect();
  renderPairPick();
  renderLibPairs();
  syncPairModeUi();
  applyVoiceFilters();
}

function formatMoney(n) {
  const v = Number(n) || 0;
  if (v > 0 && v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function shortTitle(text, max = 56) {
  const one = String(text || "").replace(/\s+/g, " ").trim();
  if (!one) return "Audio";
  if (one.length <= max) return one;
  return one.slice(0, Math.max(1, max - 1)) + "…";
}

function offerSilenceClean(path) {
  if (!path) return;
  state.pendingSilencePath = path;
  if ($("silenceOfferPath")) $("silenceOfferPath").textContent = path;
  const modal = $("silenceOfferModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeSilenceOffer() {
  const modal = $("silenceOfferModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
}

function goSilenceWithPath(path) {
  state.silenceAudioPath = path || "";
  if ($("silenceAudioPath")) $("silenceAudioPath").textContent = state.silenceAudioPath || "No file selected";
  if ($("btnSilenceRemove")) $("btnSilenceRemove").disabled = !state.silenceAudioPath;
  setTab("silence");
  refreshSilence();
}

function setPreviewPlaying(on) {
  state.previewPlaying = Boolean(on);
  if ($("btnPreview")) $("btnPreview").classList.toggle("hidden", state.previewPlaying);
  if ($("btnStopPreview")) $("btnStopPreview").classList.toggle("hidden", !state.previewPlaying);
}

function stopStudioPreview() {
  const audio = $("studioAudio");
  if (audio) {
    try { audio.pause(); audio.currentTime = 0; } catch { /* ignore */ }
  }
  setPreviewPlaying(false);
}

async function refreshDashboard() {
  try {
    const api = await waitApi();
    const dash = await api.get_dashboard();
    $("statMoney").textContent = formatMoney(dash.moneySaved || 0);
    $("statChars").textContent = Number(dash.charsGenerated || 0).toLocaleString();
    $("statExports").textContent = String(dash.exportsCount || 0);
    $("statFavs").textContent = String(dash.favorites || 0);
    $("sideExports").textContent = String(dash.exportsCount || 0);
    $("railExports").textContent = String(dash.exportsCount || 0);
    applyDayGreeting();
    if ($("overviewMoneyNote")) {
      $("overviewMoneyNote").textContent = formatMoney(dash.moneySaved || 0);
    }
    if ($("settingsVersion") && dash.version) $("settingsVersion").textContent = dash.version;
    if ($("usageMoney")) $("usageMoney").textContent = formatMoney(dash.moneySaved || 0);
  } catch {
    applyDayGreeting();
  }
}

async function refreshLibrary() {
  const api = await waitApi();
  const result = await api.list_history();
  state.history = result.items || [];
  $("statJobs").textContent = String(state.history.length);
  $("sideExports").textContent = String(state.history.length);
  const list = $("libList");
  if (!state.history.length) {
    list.innerHTML = '<div class="empty">No exports yet. Generate something in Voice Studio.</div>';
    return;
  }
  list.innerHTML = state.history.map((item) => {
    const v = findVoice(item.voice);
    const isPod = item.voice === "multi" || item.kind === "podcast";
    const label = v ? voiceMeta(v).display : (isPod ? "Podcast" : "Voice");
    const src = item.audio || item.url || "";
    const kind = isPod ? "podcast" : "studio";
    const title = shortTitle(item.title || item.text || "Audio", 56);
    return `<div class="lib-item">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(label)} · ${escapeHtml((item.createdAt || "").slice(0, 19))}</span>
      </div>
      <div class="btn-row tight">
        ${src ? `<button type="button" class="btn ghost" data-play="${escapeHtml(src)}" data-kind="${kind}">Play</button>` : `<button type="button" class="btn ghost" data-open-path="${escapeHtml(item.path || "")}">Open folder</button>`}
      </div>
    </div>`;
  }).join("");
}

async function resetHistory() {
  const api = await waitApi();
  await api.clear_history();
  state.history = [];
  await refreshLibrary();
  await refreshDashboard();
  applyVoiceFilters();
}

function playStudio(src) {
  const stage = $("studioPreviewStage");
  const audio = $("studioAudio");
  stage.classList.remove("hidden");
  audio.src = src;
  setPreviewPlaying(true);
  audio.onended = () => setPreviewPlaying(false);
  audio.play().catch(() => setPreviewPlaying(false));
}

function playLibrary(src, kind, label) {
  const stage = $("libPreviewStage");
  const audio = $("libAudio");
  if (!src) {
    if ($("libPlayHint")) $("libPlayHint").textContent = "File too large to embed. Use Open folder.";
    return;
  }
  if (kind === "podcast" || kind === "multi") {
    if ($("podcastAudio")) {
      $("podcastAudio").src = src;
      $("podcastAudio").classList.remove("hidden");
      $("podcastAudio").play().catch(() => {});
    }
  }
  if (stage && audio) {
    stage.classList.remove("hidden");
    audio.src = src;
    audio.play().catch(() => {});
    if ($("libPlayHint")) $("libPlayHint").textContent = label || "Playing";
  }
}

async function openFolderPath(path) {
  const api = await waitApi();
  if (path && typeof api.open_path === "function") {
    const result = await api.open_path(path);
    if (result && result.ok === false && $("updateHint")) {
      $("updateHint").className = "hint err";
      $("updateHint").textContent = result.message || "Could not open folder";
    }
    return result;
  }
  return api.open_output_folder();
}

function detectPodcastSpeakers(text) {
  const result = parseImportedScript(text);
  const speakers = [];
  const seen = new Set();
  result.lines.forEach((l, i) => {
    const key = l.gender;
    if (!seen.has(key + i) && !seen.has(key)) {
      /* count unique genders as cast for batch summary */
    }
    speakers.push(l.gender);
  });
  return {
    ok: !result.invalidLines.length && result.lines.length > 0,
    lines: result.lines,
    invalidLines: result.invalidLines,
    chars: result.lines.reduce((n, l) => n + l.text.length, 0),
    speakers: new Set(result.lines.map((l) => l.gender)).size,
    lineCount: result.lines.length,
  };
}

function renderBatchVoiceSelects() {
  const voiceSel = $("batchVoice");
  const pairSel = $("batchPair");
  if (voiceSel) {
    const cur = voiceSel.value || state.selectedVoice;
    voiceSel.innerHTML = '<option value="">Choose voice…</option>';
    state.voices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.shortName;
      opt.textContent = voiceLabel(v);
      if (v.shortName === cur) opt.selected = true;
      voiceSel.appendChild(opt);
    });
  }
  if (pairSel) {
    const cur = pairSel.value || state.selectedPairId;
    pairSel.innerHTML = '<option value="">Choose pair…</option>';
    state.pairs.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || "Pair";
      if (p.id === cur) opt.selected = true;
      pairSel.appendChild(opt);
    });
  }
  syncBatchModeUi();
}

function syncBatchModeUi() {
  const kind = document.querySelector('input[name="batchKind"]:checked')?.value || state.batchKind;
  const voiceMode = document.querySelector('input[name="batchVoiceMode"]:checked')?.value || state.batchVoiceMode;
  state.batchKind = kind;
  state.batchVoiceMode = voiceMode;
  if ($("batchStudioVoiceField")) $("batchStudioVoiceField").classList.toggle("hidden", kind !== "studio" || voiceMode !== "same");
  if ($("batchPodcastPairField")) $("batchPodcastPairField").classList.toggle("hidden", kind !== "podcast" || voiceMode !== "same");
  if ($("batchSameVoiceRow")) $("batchSameVoiceRow").classList.toggle("hidden", voiceMode !== "same");
  renderBatchList();
  updateBatchStats();
}

function updateBatchStats() {
  let chars = 0;
  let speakers = 0;
  state.batchItems.forEach((item) => {
    chars += item.chars || (item.text || "").length;
    speakers += item.speakers || 0;
  });
  if ($("batchStatCount")) $("batchStatCount").textContent = String(state.batchItems.length);
  if ($("batchStatChars")) $("batchStatChars").textContent = String(chars);
  if ($("batchStatSpeakers")) $("batchStatSpeakers").textContent = String(speakers);
}

function renderBatchList() {
  const box = $("batchList");
  if (!box) return;
  const kind = state.batchKind;
  const voiceMode = state.batchVoiceMode;
  if (!state.batchItems.length) {
    box.innerHTML = '<div class="empty">Add or upload scripts. Podcast mode expects Male: / Female: lines.</div>';
    return;
  }
  const voiceOpts = state.voices.map((v) => `<option value="${escapeHtml(v.shortName)}">${escapeHtml(voiceLabel(v))}</option>`).join("");
  const pairOpts = state.pairs.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || "Pair")}</option>`).join("");
  box.innerHTML = state.batchItems.map((item, i) => {
    const meta = kind === "podcast"
      ? `${item.lineCount || 0} lines · ${item.speakers || 0} speakers · ${item.chars || 0} chars`
      : `${(item.text || "").length} chars`;
    const voiceUi = voiceMode === "per"
      ? (kind === "studio"
        ? `<select data-batch-field="voice">${voiceOpts}</select>`
        : `<select data-batch-field="pairId">${pairOpts}</select>`)
      : "";
    return `<div class="batch-item" data-i="${i}">
      <div class="batch-item-top">
        <input type="text" data-batch-field="name" value="${escapeHtml(item.name || `Script ${i + 1}`)}" />
        <button type="button" class="btn ghost" data-batch-act="remove">Remove</button>
      </div>
      <p class="muted tight">${escapeHtml(meta)}${item.ok === false ? " · fix Male:/Female: lines" : ""}</p>
      <textarea data-batch-field="text" rows="4">${escapeHtml(item.text || "")}</textarea>
      ${voiceUi}
    </div>`;
  }).join("");
  box.querySelectorAll(".batch-item").forEach((row) => {
    const i = Number(row.dataset.i);
    const voiceSel = row.querySelector('select[data-batch-field="voice"]');
    if (voiceSel) voiceSel.value = state.batchItems[i].voice || state.selectedVoice || "";
    const pairSel = row.querySelector('select[data-batch-field="pairId"]');
    if (pairSel) pairSel.value = state.batchItems[i].pairId || state.selectedPairId || "";
  });
}

function syncBatchFromDom() {
  const box = $("batchList");
  if (!box) return;
  box.querySelectorAll(".batch-item").forEach((row) => {
    const i = Number(row.dataset.i);
    const item = state.batchItems[i];
    if (!item) return;
    const nameEl = row.querySelector('[data-batch-field="name"]');
    const textEl = row.querySelector('[data-batch-field="text"]');
    const voiceEl = row.querySelector('[data-batch-field="voice"]');
    const pairEl = row.querySelector('[data-batch-field="pairId"]');
    if (nameEl) item.name = nameEl.value;
    if (textEl) item.text = textEl.value;
    if (voiceEl) item.voice = voiceEl.value;
    if (pairEl) item.pairId = pairEl.value;
    if (state.batchKind === "podcast") {
      const det = detectPodcastSpeakers(item.text || "");
      item.ok = det.ok;
      item.chars = det.chars;
      item.speakers = det.speakers;
      item.lineCount = det.lineCount;
      item.parsedLines = det.lines;
    } else {
      item.chars = (item.text || "").length;
      item.speakers = 0;
      item.lineCount = 1;
      item.ok = Boolean((item.text || "").trim());
    }
  });
}

function addBatchItem(text, name) {
  const item = {
    name: name || `Script ${state.batchItems.length + 1}`,
    text: text || "",
    voice: state.selectedVoice || "",
    pairId: state.selectedPairId || "",
    ok: true,
    chars: 0,
    speakers: 0,
    lineCount: 0,
    parsedLines: [],
  };
  if (state.batchKind === "podcast") {
    const det = detectPodcastSpeakers(item.text);
    Object.assign(item, { ok: det.ok || !item.text.trim(), chars: det.chars, speakers: det.speakers, lineCount: det.lineCount, parsedLines: det.lines });
  } else {
    item.chars = item.text.length;
    item.ok = true;
  }
  state.batchItems.push(item);
  renderBatchList();
  updateBatchStats();
}

function buildPodcastLinesForBatch(item, pair) {
  const parsed = item.parsedLines && item.parsedLines.length
    ? item.parsedLines
    : detectPodcastSpeakers(item.text || "").lines;
  let maleI = 0;
  let femaleI = 0;
  return parsed.map((line, idx) => {
    const pool = voicesByGender(line.gender);
    const i = line.gender === "Female" ? femaleI++ : maleI++;
    let voice = "";
    if (pair) {
      voice = idx % 2 === 0 ? pair.host : pair.guest;
    } else {
      voice = (pool[i % Math.max(pool.length, 1)] || state.voices[0] || {}).shortName || "";
    }
    return {
      gender: line.gender,
      speaker: uniqueSpeakerName(line.gender, "en-US", i),
      text: line.text,
      voice,
    };
  });
}

async function refreshUsage() {
  try {
    const api = await waitApi();
    const u = await api.get_usage_stats();
    if ($("usageChars")) $("usageChars").textContent = Number(u.charsGenerated || 0).toLocaleString();
    if ($("usageExports")) $("usageExports").textContent = String(u.exportsCount || 0);
    if ($("usageMoney")) $("usageMoney").textContent = formatMoney(u.moneySaved || 0);
    if ($("usageBatches")) $("usageBatches").textContent = String(u.batchesCount || 0);
    if ($("usageJobsDone")) $("usageJobsDone").textContent = String(u.jobsDone || 0);
    if ($("usageJobsFail")) $("usageJobsFail").textContent = String(u.jobsFailed || 0);
    if ($("usageJobsStudio")) $("usageJobsStudio").textContent = String(u.jobsStudio || 0);
    if ($("usageJobsPod")) $("usageJobsPod").textContent = String(u.jobsPodcast || 0);
    const list = $("usageEventList");
    if (list) {
      const events = u.events || [];
      if (!events.length) {
        list.innerHTML = '<div class="empty">No usage events yet. Generate or run a batch.</div>';
      } else {
        list.innerHTML = events.map((ev) => `<div class="lib-item">
          <div>
            <strong>${escapeHtml(ev.title || ev.kind || "event")}</strong>
            <span>${escapeHtml(ev.kind || "")} · ${ev.chars || 0} chars · ${escapeHtml((ev.created_at || "").slice(0, 19))}</span>
          </div>
        </div>`).join("");
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function refreshSilence() {
  const removeBtn = $("btnSilenceRemove");
  try {
    const api = await waitApi();
    if (removeBtn) removeBtn.disabled = !state.silenceAudioPath;
    const hist = await api.list_history();
    const box = $("silenceExportList");
    if (box) {
      const items = (hist.items || []).filter((it) => it.path);
      if (!items.length) {
        box.innerHTML = '<div class="empty">Generate something first, then clean silence here.</div>';
      } else {
        box.innerHTML = items.slice(0, 12).map((item) => `<div class="lib-item">
          <div>
            <strong>${escapeHtml(shortTitle(item.title || item.text || "Audio", 48))}</strong>
            <span>${escapeHtml((item.createdAt || "").slice(0, 19))}</span>
          </div>
          <button type="button" class="btn ghost" data-silence-path="${escapeHtml(item.path || "")}">Use</button>
        </div>`).join("");
      }
    }
  } catch (err) {
    if ($("silenceHint")) {
      $("silenceHint").className = "hint err";
      $("silenceHint").textContent = safeUserError(err);
    }
  }
}

async function pollPublicStatus() {
  try {
    const api = await waitApi();
    const st = await api.get_public_status();
    const overlay = $("maintOverlay");
    if (overlay) overlay.classList.toggle("hidden", !st.maintenanceMode);
  } catch {
    /* ignore */
  }
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle("is-loading", on);
}

function renderSocial() {
  $("szSocial").innerHTML = SOCIAL.map(
    (s) => `<button type="button" class="btn" data-social="${escapeHtml(s.url)}">${escapeHtml(s.label)}</button>`
  ).join("");
}

function wire() {
  document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.goto)));

  $("rate").addEventListener("input", () => { ratePitch(); updateStudioMeta(); updatePodEta(); });
  $("pitch").addEventListener("input", ratePitch);
  $("studioText").addEventListener("input", updateStudioMeta);
  ratePitch();
  updateStudioMeta();

  $("voiceSelect").addEventListener("change", (e) => {
    state.selectedVoice = e.target.value;
    pushRecent(state.selectedVoice);
    applyVoiceFilters();
  });

  if ($("studioLang")) {
    $("studioLang").addEventListener("change", (e) => {
      state.studioLang = e.target.value;
      renderVoiceSelect();
    });
  }

  if ($("pairRadioList")) {
    $("pairRadioList").addEventListener("change", (e) => {
      const input = e.target.closest('input[name="podPair"]');
      if (input) state.selectedPairId = input.value;
    });
  }

  if ($("libTabs")) {
    $("libTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lib]");
      if (!btn) return;
      state.libPane = btn.dataset.lib;
      document.querySelectorAll(".lib-tab").forEach((t) => t.classList.toggle("active", t.dataset.lib === state.libPane));
      $("libExportsPane").classList.toggle("hidden", state.libPane !== "exports");
      $("libPairsPane").classList.toggle("hidden", state.libPane !== "pairs");
      if (state.libPane === "pairs") renderLibPairs();
    });
  }

  if ($("pairSearch")) {
    $("pairSearch").addEventListener("input", renderLibPairs);
  }

  if ($("libPairsList")) {
    $("libPairsList").addEventListener("click", async (e) => {
      const card = e.target.closest(".pair-edit-card");
      const btn = e.target.closest("button[data-act]");
      if (!card || !btn) return;
      const id = card.dataset.pairId;
      const api = await waitApi();
      if (btn.dataset.act === "del-pair") {
        const result = await api.delete_podcast_pair(id);
        state.pairs = result.pairs || [];
        renderPairsList();
        renderPairSelect();
        renderLibPairs();
        return;
      }
      if (btn.dataset.act === "use-pair") {
        state.selectedPairId = id;
        setTab("podcast");
        applySelectedPair();
        return;
      }
      if (btn.dataset.act === "save-pair") {
        const result = await api.update_podcast_pair({
          id,
          name: card.querySelector('[data-field="name"]').value,
          host: card.querySelector('[data-field="host"]').value,
          guest: card.querySelector('[data-field="guest"]').value,
        });
        if (result.ok) {
          state.pairs = result.pairs || [];
          renderPairsList();
          renderPairSelect();
          renderLibPairs();
        }
      }
    });
  }

  ["voiceSearch", "langFilter", "genderFilter", "voiceScope"].forEach((id) => {
    $(id).addEventListener("input", applyVoiceFilters);
    $(id).addEventListener("change", applyVoiceFilters);
  });

  $("voiceGrid").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    const card = e.target.closest(".voice-card");
    if (!btn || !card) return;
    const voice = card.dataset.voice;
    const api = await waitApi();

    if (btn.dataset.act === "use") {
      state.selectedVoice = voice;
      pushRecent(voice);
      renderVoiceSelect();
      applyVoiceFilters();
      setTab("studio");
      return;
    }

    if (btn.dataset.act === "save") {
      const result = await api.toggle_favorite(voice);
      state.favorites = result.favorites || [];
      renderFavList();
      applyVoiceFilters();
      refreshDashboard();
      return;
    }

    if (btn.dataset.act === "pair") {
      if (state.pairPick.includes(voice)) {
        state.pairPick = state.pairPick.filter((v) => v !== voice);
      } else if (state.pairPick.length < 2) {
        state.pairPick = [...state.pairPick, voice];
      } else {
        state.pairPick = [state.pairPick[1], voice];
      }
      renderPairPick();
      applyVoiceFilters();
      return;
    }

    if (btn.dataset.act === "preview") {
      if (state.previewing) return;
      const { rate, pitch, volume } = ratePitch();
      state.previewing = voice;
      applyVoiceFilters();
      const liveCard = document.querySelector(`.voice-card[data-voice="${CSS.escape(voice)}"]`);
      const slot = liveCard && liveCard.querySelector("[data-preview-slot]");
      try {
        const result = await api.preview_voice(voice, rate, pitch, volume);
        if (!result.ok) throw new Error(result.message || "Preview failed");
        pushRecent(voice);
        if (slot) {
          slot.classList.add("active");
          slot.innerHTML = `<div class="preview-wave"><i></i><i></i><i></i><i></i><i></i></div><audio controls autoplay src="${result.audio}"></audio>`;
          const audio = slot.querySelector("audio");
          audio.addEventListener("ended", () => {
            state.previewing = null;
            applyVoiceFilters();
          });
        }
        playStudio(result.audio);
      } catch (err) {
        state.previewing = null;
        applyVoiceFilters();
        $("studioHint").className = "hint err";
        $("studioHint").textContent = safeUserError(err);
      }
    }
  });

  $("recentVoices").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-recent]");
    if (!btn) return;
    state.selectedVoice = btn.dataset.recent;
    renderVoiceSelect();
    applyVoiceFilters();
    setTab("studio");
  });
  $("favList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-recent]");
    if (!btn) return;
    const id = btn.dataset.recent;
    state.selectedVoice = id;
    // toggle into pair pick if user is building a pair
    if (state.pairPick.includes(id)) {
      state.pairPick = state.pairPick.filter((v) => v !== id);
    } else if (state.pairPick.length < 2) {
      state.pairPick = [...state.pairPick, id];
    } else {
      state.pairPick = [state.pairPick[1], id];
    }
    renderVoiceSelect();
    renderPairPick();
    renderFavList();
    applyVoiceFilters();
    document.querySelectorAll(".fav-item").forEach((el) => {
      el.classList.toggle("selected", state.pairPick.includes(el.dataset.recent) || el.dataset.recent === state.selectedVoice);
    });
  });

  $("btnSavePair").addEventListener("click", async () => {
    const hint = $("pairSaveHint");
    if (state.pairPick.length !== 2) {
      $("pairPickBox").textContent = "Select exactly 2 voices first";
      if (hint) {
        hint.className = "hint err";
        hint.textContent = "Click Pair on 2 different voice cards first.";
      }
      return;
    }
    const mode = document.querySelector('input[name="pairMode"]:checked')?.value || "create";
    const name = $("pairName").value.trim();
    if (!name) {
      $("pairName").focus();
      if (hint) {
        hint.className = "hint err";
        hint.textContent = "Enter a pair name.";
      }
      return;
    }
    const payload = {
      mode,
      name,
      host: state.pairPick[0],
      guest: state.pairPick[1],
    };
    if (mode === "update") {
      payload.id = $("pairUpdateSelect").value;
      if (!payload.id) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = "Select which old pair to update.";
        }
        return;
      }
    }
    const api = await waitApi();
    const result = await api.save_podcast_pair(payload);
    if (!result || !result.ok) {
      $("pairPickBox").textContent = (result && result.message) || "Could not save pair";
      if (hint) {
        hint.className = "hint err";
        hint.textContent = (result && result.message) || "Could not save pair";
      }
      return;
    }
    state.pairs = result.pairs || [];
    state.pairPick = [];
    $("pairName").value = "";
    renderPairPick();
    renderPairsList();
    renderPairSelect();
    renderLibPairs();
    syncPairModeUi();
    refreshDashboard();
    if (hint) {
      hint.className = "hint ok";
      hint.textContent = mode === "update"
        ? `Updated “${result.pair.name}”.`
        : `Created “${result.pair.name}”. You can make more pairs anytime.`;
    }
  });

  document.querySelectorAll('input[name="pairMode"]').forEach((el) => {
    el.addEventListener("change", syncPairModeUi);
  });
  if ($("pairUpdateSelect")) {
    $("pairUpdateSelect").addEventListener("change", () => {
      const pair = state.pairs.find((p) => p.id === $("pairUpdateSelect").value);
      if (pair) $("pairName").value = pair.name;
    });
  }

  $("pairsList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del-pair]");
    if (!btn) return;
    const api = await waitApi();
    const result = await api.delete_podcast_pair(btn.dataset.delPair);
    state.pairs = result.pairs || [];
    renderPairsList();
    renderPairSelect();
  });

  function applySelectedPair() {
    const id = state.selectedPairId || ($("pairRadioList") && $("pairRadioList").querySelector('input[name="podPair"]:checked')?.value);
    const pair = state.pairs.find((p) => p.id === id);
    if (!pair) {
      setPodProgress(0, "Select a saved pair first");
      return;
    }
    state.selectedPairId = pair.id;
    if (state.lines[0]) {
      state.lines[0].voice = pair.host;
      state.lines[0].speaker = state.lines[0].speaker || "Host";
      state.lines[0].gender = "Male";
    }
    if (state.lines[1]) {
      state.lines[1].voice = pair.guest;
      state.lines[1].speaker = state.lines[1].speaker || "Guest";
      state.lines[1].gender = "Female";
    } else {
      state.lines.push({ speaker: "Guest", gender: "Female", voice: pair.guest, text: "" });
    }
    state.lines.forEach((line, i) => {
      line.voice = i % 2 === 0 ? pair.host : pair.guest;
    });
    renderPodcast();
    updatePodEta();
    setPodProgress(0, `Pair “${pair.name}” applied as Host / Guest`);
  }

  $("btnApplyPair").addEventListener("click", applySelectedPair);

  $("btnPreview").addEventListener("click", async () => {
    const hint = $("studioHint");
    if (!state.selectedVoice) {
      hint.className = "hint err";
      hint.textContent = "Choose a voice first.";
      return;
    }
    const api = await waitApi();
    const { rate, pitch, volume } = ratePitch();
    setLoading($("btnPreview"), true);
    hint.className = "hint";
    hint.textContent = "Generating preview…";
    try {
      const result = await api.preview_voice(state.selectedVoice, rate, pitch, volume);
      if (!result.ok) throw new Error(result.message || "Preview failed");
      pushRecent(state.selectedVoice);
      playStudio(result.audio || result.url);
      hint.className = "hint ok";
      hint.textContent = "Preview playing — press Stop anytime.";
    } catch (err) {
      hint.className = "hint err";
      hint.textContent = safeUserError(err);
    } finally {
      setLoading($("btnPreview"), false);
    }
  });
  if ($("btnStopPreview")) {
    $("btnStopPreview").addEventListener("click", () => {
      stopStudioPreview();
      if ($("studioHint")) {
        $("studioHint").className = "hint";
        $("studioHint").textContent = "Preview stopped.";
      }
    });
  }

  $("btnGenerate").addEventListener("click", async () => {
    const hint = $("studioHint");
    const text = $("studioText").value.trim();
    if (!text) {
      hint.className = "hint err";
      hint.textContent = "Enter some text.";
      return;
    }
    const api = await waitApi();
    const { rate, pitch, volume } = ratePitch();
    setLoading($("btnGenerate"), true);
    hint.className = "hint";
    hint.textContent = "Generating…";
    try {
      const result = await api.generate_audio({
        text,
        voice: state.selectedVoice,
        rate,
        pitch,
        volume,
      });
      if (!result.ok) throw new Error(result.message || "Generation failed");
      if (result.queued) {
        state.activeJobId = result.job && result.job.id;
        hint.className = "hint ok";
        hint.textContent = `Job ${state.activeJobId} started · watch progress in Jobs`;
        setPodProgress(0.02, "Job queued…");
        refreshJobs();
        setTab("jobs");
        return;
      }
      pushRecent(state.selectedVoice);
      if (result.audio) playStudio(result.audio);
      hint.className = "hint ok";
      hint.textContent = result.large
        ? `Long audio saved → ${result.path}`
        : `Saved → ${result.path}`;
      await refreshLibrary();
      await refreshDashboard();
    } catch (err) {
      hint.className = "hint err";
      hint.textContent = safeUserError(err);
    } finally {
      setLoading($("btnGenerate"), false);
    }
  });

  $("btnAddLine").addEventListener("click", () => {
    if (state.podLinesOpen) syncPodcastFromDom();
    const i = state.lines.length;
    const gender = i % 2 === 1 ? "Female" : "Male";
    const pool = voicesByGender(gender);
    state.lines.push({
      speaker: uniqueSpeakerName(gender, "en-US", i),
      gender,
      voice: (pool[i % Math.max(pool.length, 1)] || {}).shortName || state.selectedVoice,
      text: "",
    });
    state.podLinesOpen = true;
    renderPodcast();
    updatePodEta();
  });

  if ($("podcastLines")) {
    $("podcastLines").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act='remove']");
      if (!btn) return;
      syncPodcastFromDom();
      const i = Number(btn.closest(".pod-line").dataset.i);
      state.lines.splice(i, 1);
      if (!state.lines.length) state.lines.push({ speaker: "Host", gender: "Male", voice: state.selectedVoice, text: "" });
      renderPodcast();
      updatePodEta();
    });
    $("podcastLines").addEventListener("input", updatePodEta);
    $("podcastLines").addEventListener("change", updatePodEta);
  }

  $("btnImportScript").addEventListener("click", async () => {
    try {
      const api = await waitApi();
      const result = await api.pick_script_file();
      if (!result.ok) {
        openImportModal();
        return;
      }
      applyPodcastScriptText(result.text || "", result.name || "");
    } catch {
      openImportModal();
    }
  });
  if ($("btnParsePodcastScript")) {
    $("btnParsePodcastScript").addEventListener("click", () => {
      applyPodcastScriptText(($("podcastScriptBox") && $("podcastScriptBox").value) || "");
    });
  }
  if ($("podcastScriptBox")) {
    $("podcastScriptBox").addEventListener("input", () => {
      // live soft stats from raw male/female text if parseable
      const raw = $("podcastScriptBox").value;
      const parsed = parseImportedScript(raw);
      if (!parsed.invalidLines.length && parsed.lines.length) {
        // don't overwrite assigned voices continuously; only update visible script stats estimate
        const words = parsed.lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
        const mins = (words / 150).toFixed(1);
        if ($("podStatLines")) $("podStatLines").textContent = String(parsed.lines.length);
        if ($("podStatSpeakers")) $("podStatSpeakers").textContent = String(parsed.lines.filter((l,i,a)=>a.findIndex(x=>x.gender===l.gender)===i || true).length ? new Set(parsed.lines.map(l=>l.gender)).size : 0);
        // better speaker count after build; for raw show gender count
        if ($("podStatSpeakers")) $("podStatSpeakers").textContent = String(new Set(parsed.lines.map((l) => l.gender)).size);
        if ($("podStatChars")) $("podStatChars").textContent = String(parsed.lines.reduce((n, l) => n + l.text.length, 0));
        if ($("podStatMinutes")) $("podStatMinutes").textContent = String(mins);
      }
    });
  }
  $("btnScriptHelp").addEventListener("click", openHelpModal);
  $("btnCloseImport").addEventListener("click", closeImportModal);
  $("btnCloseHelp").addEventListener("click", closeHelpModal);
  $("importScriptText").addEventListener("input", updateImportFeedback);
  $("btnApplyImport").addEventListener("click", () => {
    applyImportedScript();
    if ($("podcastScriptBox") && $("importScriptText")) {
      $("podcastScriptBox").value = $("importScriptText").value;
    }
    updatePodStats();
  });
  $("importModal").addEventListener("click", (e) => { if (e.target === $("importModal")) closeImportModal(); });
  $("helpModal").addEventListener("click", (e) => { if (e.target === $("helpModal")) closeHelpModal(); });

  $("btnPodcast").addEventListener("click", async () => {
    if (state.podLinesOpen) syncPodcastFromDom();
    const boxVal = ($("podcastScriptBox") && $("podcastScriptBox").value) || "";
    if (boxVal.trim()) {
      applyPodcastScriptText(boxVal);
    }
    updatePodEta();
    const hint = $("podcastHint");
    const api = await waitApi();
    const { rate, pitch, volume } = ratePitch();
    setLoading($("btnPodcast"), true);
    setPodProgress(0.02, "Rendering your conversation…");
    hint.className = "hint";
    hint.textContent = "Generating podcast…";
    try {
      const result = await api.generate_podcast({
        lines: state.lines.map((l) => ({ text: l.text, voice: l.voice, speaker: l.speaker })),
        rate,
        pitch,
        volume,
      });
      if (!result.ok) throw new Error(result.message || "Failed");
      if (result.queued) {
        state.activeJobId = result.job && result.job.id;
        setPodProgress(0.02, "Podcast job queued…");
        hint.className = "hint ok";
        hint.textContent = `Job ${state.activeJobId} running · Jobs tab`;
        refreshJobs();
        setTab("jobs");
        return;
      }
      $("podcastAudio").src = result.audio || result.url;
      $("podcastAudio").classList.remove("hidden");
      $("podcastAudio").play().catch(() => {});
      setPodProgress(1, "Podcast ready");
      hint.className = "hint ok";
      hint.textContent = `Saved → ${result.path}`;
      await refreshLibrary();
      await refreshDashboard();
    } catch (err) {
      setPodProgress(0, "Podcast failed");
      hint.className = "hint err";
      hint.textContent = safeUserError(err);
    } finally {
      setLoading($("btnPodcast"), false);
    }
  });

  $("btnRefreshVoices").addEventListener("click", () => loadVoices(true).catch(console.error));
  $("btnRefreshLib").addEventListener("click", () => refreshLibrary());
  $("btnResetHistory").addEventListener("click", () => resetHistory());
  $("btnResetHistorySide").addEventListener("click", () => resetHistory());

  $("libList").addEventListener("click", async (e) => {
    const openBtn = e.target.closest("button[data-open-path]");
    if (openBtn) {
      await openFolderPath(openBtn.dataset.openPath || "");
      return;
    }
    const btn = e.target.closest("button[data-play]");
    if (!btn) return;
    playLibrary(btn.dataset.play, btn.dataset.kind || "studio", "Playing export");
  });

  $("btnChooseOut").addEventListener("click", async () => {
    const api = await waitApi();
    const result = await api.choose_output_folder();
    if (result.path) {
      state.outputDir = result.path;
      $("outputPath").textContent = result.path;
    }
  });
  $("btnCreateOut").addEventListener("click", async () => {
    const api = await waitApi();
    const result = await api.create_output_folder();
    if (result.path) {
      state.outputDir = result.path;
      $("outputPath").textContent = result.path;
    }
  });
  $("btnOpenOut").addEventListener("click", async () => {
    const hint = $("settingsFolderHint") || $("updateHint");
    const api = await waitApi();
    const result = await api.open_output_folder();
    if (hint) {
      if (result && result.ok === false) {
        hint.className = "hint err";
        hint.textContent = result.message || "Could not open folder";
      } else {
        hint.className = "hint ok";
        hint.textContent = "Opened your ShiftVoice download folder.";
      }
    }
  });
  if ($("btnOpenOutHint")) {
    $("btnOpenOutHint").addEventListener("click", () => $("btnOpenOut").click());
  }
  $("btnCheckUpdates").addEventListener("click", async () => {
    const api = await waitApi();
    const result = await api.check_updates();
    $("updateHint").className = "hint ok";
    $("updateHint").textContent = result.message || "Up to date";
  });

  async function openUrl(url) {
    const api = await waitApi();
    await api.open_external_url(url);
  }
  $("btnShiftZero").addEventListener("click", () => openUrl("https://shiftzero.netlify.app"));
  $("btnExploreProducts").addEventListener("click", () => openUrl("https://shiftzero.netlify.app"));
  $("szSocial").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-social]");
    if (btn) openUrl(btn.dataset.social);
  });
  document.querySelectorAll("[data-external]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openUrl(el.getAttribute("data-external"));
    });
  });

  if ($("btnTogglePodLines")) {
    $("btnTogglePodLines").addEventListener("click", () => {
      if (state.podLinesOpen) syncPodcastFromDom();
      state.podLinesOpen = !state.podLinesOpen;
      renderPodcast();
    });
  }

  if ($("jobsList")) {
    $("jobsList").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-job-act]");
      if (!btn) return;
      const act = btn.dataset.jobAct;
      if (act === "play") {
        playLibrary(btn.dataset.src, btn.dataset.kind === "podcast" ? "podcast" : "studio", "Playing job");
        setTab("library");
        return;
      }
      if (act === "library") {
        setTab("library");
        refreshLibrary();
        return;
      }
      if (act === "folder") {
        await openFolderPath(btn.dataset.path || "");
      }
    });
  }

  window.__shiftvoiceProgress = (detail) => {
    if (!detail) return;
    if (detail.phase === "line" || detail.phase === "start" || detail.phase === "done" || detail.phase === "running" || detail.phase === "queued") {
      setPodProgress(detail.progress || 0, detail.label || "");
      if (state.tab === "studio" && $("studioHint")) {
        $("studioHint").className = "hint";
        $("studioHint").textContent = detail.label || "Working…";
      }
    }
  };

  window.__shiftvoiceJobUpdate = (payload) => {
    const job = payload && payload.job;
    if (!job) return;
    const idx = state.jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) state.jobs[idx] = job;
    else state.jobs.unshift(job);
    if (state.tab === "jobs") renderJobs(state.jobs);
    if (job.status === "done" || job.status === "failed") {
      refreshLibrary();
      refreshDashboard();
    }
    if (state.activeJobId === job.id) {
      setPodProgress(job.progress || 0, job.label || job.status);
      if (job.status === "done") {
        if (job.audio) {
          if (job.kind === "podcast") {
            $("podcastAudio").src = job.audio;
            $("podcastAudio").classList.remove("hidden");
          } else {
            playStudio(job.audio);
          }
        }
        if ($("podcastHint")) {
          $("podcastHint").className = "hint ok";
          $("podcastHint").textContent = job.path ? `Saved → ${job.path}` : "Job done";
        }
        if ($("studioHint") && job.kind === "studio") {
          $("studioHint").className = "hint ok";
          $("studioHint").textContent = job.path ? `Saved → ${job.path}` : "Job done";
        }
        if (job.path && (job.kind === "studio" || job.kind === "podcast")) {
          offerSilenceClean(job.path);
        }
      }
      if (job.status === "failed") {
        if ($("podcastHint")) {
          $("podcastHint").className = "hint err";
          $("podcastHint").textContent = safeUserError(job.error || "Job failed");
        }
        if ($("studioHint") && job.kind === "studio") {
          $("studioHint").className = "hint err";
          $("studioHint").textContent = safeUserError(job.error || "Job failed");
        }
      }
    } else if (job.status === "done" && job.path && (job.kind === "studio" || job.kind === "podcast")) {
      offerSilenceClean(job.path);
    }
  };

  if ($("btnRefreshJobs")) $("btnRefreshJobs").addEventListener("click", () => refreshJobs());
  if ($("jobSearch")) $("jobSearch").addEventListener("input", () => refreshJobs());
  if ($("libSavedVoices")) {
    $("libSavedVoices").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recent]");
      if (!btn) return;
      state.selectedVoice = btn.dataset.recent;
      renderVoiceSelect();
      setTab("studio");
    });
  }

  document.querySelectorAll('input[name="batchKind"]').forEach((el) => {
    el.addEventListener("change", () => {
      syncBatchFromDom();
      syncBatchModeUi();
    });
  });
  document.querySelectorAll('input[name="batchVoiceMode"]').forEach((el) => {
    el.addEventListener("change", () => {
      syncBatchFromDom();
      syncBatchModeUi();
    });
  });
  if ($("btnBatchAddBlank")) {
    $("btnBatchAddBlank").addEventListener("click", () => addBatchItem("", `Script ${state.batchItems.length + 1}`));
  }
  if ($("btnBatchUpload")) {
    $("btnBatchUpload").addEventListener("click", async () => {
      const hint = $("batchHint");
      try {
        const api = await waitApi();
        const result = await api.pick_script_files();
        if (!result.ok) {
          if (hint) {
            hint.className = "hint err";
            hint.textContent = result.message || "No files";
          }
          return;
        }
        (result.files || []).forEach((f) => addBatchItem(f.text || "", f.name || "script"));
        if (hint) {
          hint.className = "hint ok";
          hint.textContent = `Loaded ${(result.files || []).length} script(s)`;
        }
      } catch (err) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = safeUserError(err);
        }
      }
    });
  }
  if ($("batchList")) {
    $("batchList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-batch-act='remove']");
      if (!btn) return;
      syncBatchFromDom();
      const i = Number(btn.closest(".batch-item").dataset.i);
      state.batchItems.splice(i, 1);
      renderBatchList();
      updateBatchStats();
    });
    $("batchList").addEventListener("input", () => {
      syncBatchFromDom();
      updateBatchStats();
    });
    $("batchList").addEventListener("change", () => {
      syncBatchFromDom();
      updateBatchStats();
    });
  }
  if ($("btnBatchStart")) {
    $("btnBatchStart").addEventListener("click", async () => {
      syncBatchFromDom();
      const hint = $("batchHint");
      const kind = state.batchKind;
      const voiceMode = state.batchVoiceMode;
      const sameVoice = ($("batchVoice") && $("batchVoice").value) || state.selectedVoice;
      const samePairId = ($("batchPair") && $("batchPair").value) || state.selectedPairId;
      const samePair = state.pairs.find((p) => p.id === samePairId);
      const { rate, pitch, volume } = ratePitch();
      const items = [];
      for (const item of state.batchItems) {
        if (kind === "studio") {
          const text = (item.text || "").trim();
          const voice = voiceMode === "same" ? sameVoice : (item.voice || sameVoice);
          if (!text || !voice) continue;
          items.push({ name: item.name, text, voice });
        } else {
          const pair = voiceMode === "same"
            ? samePair
            : state.pairs.find((p) => p.id === item.pairId) || samePair;
          const lines = buildPodcastLinesForBatch(item, pair);
          if (!lines.length) continue;
          items.push({ name: item.name, lines });
        }
      }
      if (!items.length) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = kind === "studio"
            ? "Need script text + voice (same for all, or per script)."
            : "Need valid Male:/Female: scripts + a podcast pair.";
        }
        return;
      }
      setLoading($("btnBatchStart"), true);
      if (hint) {
        hint.className = "hint";
        hint.textContent = `Queueing ${items.length} jobs…`;
      }
      try {
        const api = await waitApi();
        const result = await api.enqueue_batch({ mode: kind, items, rate, pitch, volume });
        if (!result.ok) throw new Error(result.message || "Batch failed");
        if (hint) {
          hint.className = "hint ok";
          hint.textContent = `Queued ${result.count} job(s)${(result.errors || []).length ? ` · ${result.errors.length} skipped` : ""}`;
        }
        await refreshJobs();
        await refreshUsage();
        setTab("jobs");
      } catch (err) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = safeUserError(err);
        }
      } finally {
        setLoading($("btnBatchStart"), false);
      }
    });
  }
  if ($("btnRefreshUsage")) $("btnRefreshUsage").addEventListener("click", () => refreshUsage());

  if ($("btnSilenceRefresh")) $("btnSilenceRefresh").addEventListener("click", () => refreshSilence());
  if ($("btnSilencePick")) {
    $("btnSilencePick").addEventListener("click", async () => {
      const api = await waitApi();
      const result = await api.pick_audio_file();
      if (!result.ok) return;
      state.silenceAudioPath = result.path || "";
      if ($("silenceAudioPath")) $("silenceAudioPath").textContent = state.silenceAudioPath;
      if ($("btnSilenceRemove")) $("btnSilenceRemove").disabled = !state.silenceAudioPath;
    });
  }
  if ($("silenceExportList")) {
    $("silenceExportList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-silence-path]");
      if (!btn) return;
      state.silenceAudioPath = btn.dataset.silencePath || "";
      if ($("silenceAudioPath")) $("silenceAudioPath").textContent = state.silenceAudioPath;
      if ($("btnSilenceRemove")) $("btnSilenceRemove").disabled = !state.silenceAudioPath;
    });
  }
  if ($("btnSilenceRemove")) {
    $("btnSilenceRemove").addEventListener("click", async () => {
      const hint = $("silenceHint");
      if (!state.silenceAudioPath) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = "Choose a file first.";
        }
        return;
      }
      setLoading($("btnSilenceRemove"), true);
      if (hint) {
        hint.className = "hint";
        hint.textContent = "Removing silence…";
      }
      try {
        const api = await waitApi();
        const keep = Number(($("silenceKeep") && $("silenceKeep").value) || 0.05);
        const result = await api.remove_silence({ path: state.silenceAudioPath, keepSilence: keep });
        if (!result.ok) throw new Error(result.message || "Failed");
        if (hint) {
          hint.className = "hint ok";
          hint.textContent = result.message || "Done";
        }
        if (result.audio && $("silenceAudio") && $("silencePreviewStage")) {
          $("silencePreviewStage").classList.remove("hidden");
          $("silenceAudio").src = result.audio;
          $("silenceAudio").play().catch(() => {});
        }
        state.silenceAudioPath = result.path || state.silenceAudioPath;
        if ($("silenceAudioPath")) $("silenceAudioPath").textContent = state.silenceAudioPath;
        await refreshLibrary();
        await refreshSilence();
      } catch (err) {
        if (hint) {
          hint.className = "hint err";
          hint.textContent = safeUserError(err);
        }
      } finally {
        setLoading($("btnSilenceRemove"), false);
      }
    });
  }

  if ($("silenceKeepPills")) {
    $("silenceKeepPills").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-keep]");
      if (!btn) return;
      $("silenceKeepPills").querySelectorAll(".keep-pill").forEach((el) => el.classList.toggle("active", el === btn));
      if ($("silenceKeep")) $("silenceKeep").value = btn.dataset.keep;
      const labels = { "0": "None · tight cuts", "0.05": "Soft · 0.05s breath between phrases", "0.1": "Natural · 0.1s pauses", "0.2": "Long · 0.2s pauses" };
      if ($("silenceKeepLabel")) $("silenceKeepLabel").textContent = labels[btn.dataset.keep] || "";
    });
  }

  if ($("btnSilenceOfferLater")) $("btnSilenceOfferLater").addEventListener("click", () => closeSilenceOffer());
  if ($("btnSilenceOfferJobs")) {
    $("btnSilenceOfferJobs").addEventListener("click", () => {
      closeSilenceOffer();
      setTab("jobs");
      refreshJobs();
    });
  }
  if ($("btnSilenceOfferGo")) {
    $("btnSilenceOfferGo").addEventListener("click", () => {
      const path = state.pendingSilencePath;
      closeSilenceOffer();
      goSilenceWithPath(path);
    });
  }
  if ($("silenceOfferModal")) {
    $("silenceOfferModal").addEventListener("click", (e) => {
      if (e.target === $("silenceOfferModal")) closeSilenceOffer();
    });
  }
}

async function boot() {
  const started = Date.now();
  applyDayGreeting();
  wire();
  renderSocial();
  try {
    await waitApi();
    await Promise.all([checkOnline(), loadSettings(), loadVoices(false)]);
    await loadLibrary();
    renderFavList();
    renderPairSelect();
    renderLibPairs();
    renderLibSavedVoices();
    syncPairModeUi();
    renderBatchVoiceSelects();
    await refreshLibrary();
    await refreshDashboard();
    await refreshJobs();
    await refreshUsage();
    await pollPublicStatus();
    setInterval(() => { pollPublicStatus().catch(() => {}); }, 15000);
    updatePodEta();
    setTab("dashboard");
  } catch (err) {
    applyDayGreeting();
    if ($("studioHint")) {
      $("studioHint").className = "hint err";
      $("studioHint").textContent = safeUserError(err);
    }
  } finally {
    const wait = Math.max(0, 2000 - (Date.now() - started));
    setTimeout(() => {
      $("boot").classList.add("hide");
      setTimeout(() => $("boot") && $("boot").remove(), 350);
    }, wait);
  }
}

window.addEventListener("pywebviewready", boot);
if (document.readyState !== "loading") {
  setTimeout(() => { if (apiReady()) boot(); }, 200);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => { if (apiReady()) boot(); }, 200);
  });
}
