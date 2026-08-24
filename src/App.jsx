import { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";

// ── Constants ─────────────────────────────────────────────────────────────────
const TRACK_COLORS = [
  "#22d3ee","#f472b6","#a78bfa","#34d399",
  "#fb923c","#60a5fa","#fbbf24","#f87171",
  "#4ade80","#e879f9","#38bdf8","#ff9966",
];
const SIDEBAR_W     = 188;   // slightly wider for vol/pan controls
const TRACK_H       = 92;   // taller to accommodate second control row
const RULER_H       = 30;
const SNAP_GRID     = 0.05;
const TOTAL_SECS    = 600;
const MAX_ITEM_SECS = 47;
const SERVER        = "http://localhost:8000";
const DEFAULT_STEPS = 300;

let _uid = 0;
const uid     = (p) => `${p}_${++_uid}`;
const snap    = (v, g = SNAP_GRID) => Math.round(v / g) * g;
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};
const audioUrl = (itemId, ver) => `${SERVER}/audio/${itemId}.wav?v=${ver || 0}`;
const fmtPan   = (p) => Math.abs(p) < 0.02 ? "C" : `${p > 0 ? "R" : "L"}${Math.abs(Math.round(p * 100))}`;
const fmtVol   = (v) => `${Math.round(v * 100)}%`;

// ── REAPER export helpers ─────────────────────────────────────────────────────
function makeGuid() {
  // Returns {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
  const s = () => Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
  return `{${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}}`;
}

function buildRpp(title, tracks) {
  // Only export tracks that have at least one generated (done) item
  const exportTracks = tracks
    .map(t => ({ ...t, items: t.items.filter(i => i.status === "done") }))
    .filter(t => t.items.length > 0);

  let iid = 0;
  const timestamp = Math.floor(Date.now() / 1000);

  const trackBlocks = exportTracks.map(track => {
    const tGuid = makeGuid();
    const vol   = track.vol ?? 1;
    const pan   = track.pan ?? 0;

    const itemBlocks = [...track.items]
      .sort((a, b) => a.begin - b.begin)
      .map(item => {
        iid++;
        const fname    = `${item.id}.wav`;
        const dispName = item.name ? item.name.replace(/[/\\?%*:|"<>]/g, "_") : item.id;
        return [
          `    <ITEM`,
          `      POSITION ${item.begin}`,
          `      SNAPOFFS 0`,
          `      LENGTH ${item.length}`,
          `      LOOP 1`,
          `      ALLTAKES 0`,
          `      FADEIN 1 0 0 1 0 0 0`,
          `      FADEOUT 1 0 0 1 0 0 0`,
          `      MUTE 0 0`,
          `      SEL 0`,
          `      IGUID ${makeGuid()}`,
          `      IID ${iid}`,
          `      NAME ${dispName}`,
          `      VOLPAN 1 0 1 -1`,
          `      SOFFS 0`,
          `      PLAYRATE 1 1 0 -1 0 0.0025`,
          `      CHANMODE 0`,
          `      GUID ${makeGuid()}`,
          `      <SOURCE WAVE`,
          `        FILE "Media\\${fname}"`,
          `      >`,
          `    >`,
        ].join("\n");
      })
      .join("\n");

    return [
      `  <TRACK ${tGuid}`,
      `    NAME "${track.name}"`,
      `    PEAKCOL 16576`,
      `    BEAT -1`,
      `    AUTOMODE 0`,
      `    PANLAWFLAGS 3`,
      `    VOLPAN ${vol} ${pan} -1 -1 1`,
      `    MUTESOLO 0 0 0`,
      `    IPHASE 0`,
      `    PLAYOFFS 0 1`,
      `    ISBUS 0 0`,
      `    BUSCOMP 0 0 0 0 0`,
      `    SHOWINMIX 1 0.6667 0.5 1 0.5 0 0 0 0`,
      `    FIXEDLANES 9 0 0 0 0`,
      `    SEL 0`,
      `    REC 0 0 1 0 0 0 0 0`,
      `    VU 64`,
      `    TRACKHEIGHT 0 0 0 0 0 0 0`,
      `    INQ 0 0 0 0.5 100 0 0 100`,
      `    NCHAN 2`,
      `    FX 1`,
      `    TRACKID ${tGuid}`,
      `    PERF 0`,
      `    MIDIOUT -1`,
      `    MAINSEND 1 0`,
      itemBlocks,
      `  >`,
    ].join("\n");
  }).join("\n");

  return [
    `<REAPER_PROJECT 0.1 "7.65/win64" ${timestamp} 0`,
    `  <NOTES 0 2`,
    `  >`,
    `  RIPPLE 0 0`,
    `  GROUPOVERRIDE 0 0 0 0`,
    `  AUTOXFADE 129`,
    `  ENVATTACH 3`,
    `  POOLEDENVATTACH 0`,
    `  TCPUIFLAGS 0`,
    `  MIXERUIFLAGS 11 48`,
    `  PEAKGAIN 1`,
    `  FEEDBACK 0`,
    `  PANLAW 1`,
    `  PROJOFFS 0 0 0`,
    `  MAXPROJLEN 0 0`,
    `  GRID 3199 8 1 8 1 0 0 0`,
    `  TIMEMODE 1 5 -1 30 0 0 -1 0`,
    `  PANMODE 3`,
    `  PANLAWFLAGS 3`,
    `  CURSOR 0`,
    `  ZOOM 100 0 0`,
    `  VZOOMEX 6 0`,
    `  USE_REC_CFG 0`,
    `  RECMODE 1`,
    `  LOOP 0`,
    `  RECORD_PATH "Media" ""`,
    `  RENDER_FILE ""`,
    `  RENDER_PATTERN ""`,
    `  RENDER_FMT 0 2 0`,
    `  RENDER_1X 0`,
    `  RENDER_RANGE 1 0 0 0 1000`,
    `  TIMELOCKMODE 1`,
    `  TEMPOENVLOCKMODE 1`,
    `  ITEMMIX 1`,
    `  DEFPITCHMODE 589824 0`,
    `  TAKELANE 1`,
    `  SAMPLERATE 44100 0 0`,
    `  LOCK 1`,
    `  TEMPO 120 4 4 0`,
    `  PLAYRATE 1 0 0.25 4`,
    `  SELECTION 0 0`,
    `  SELECTION2 0 0`,
    `  MASTERAUTOMODE 0`,
    `  MASTERTRACKHEIGHT 0 0`,
    `  MASTERPEAKCOL 16576`,
    `  MASTERMUTESOLO 0`,
    `  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 0 0 0 0 0 0 0 0 0 1`,
    `  MASTERHWOUT 0 0 1 0 0 0 0 -1`,
    `  MASTER_NCH 2 2`,
    `  MASTER_VOLUME 1 0 -1 -1 1`,
    `  MASTER_PANMODE 3`,
    `  MASTER_FX 1`,
    `  MASTER_SEL 0`,
    `  <PROJBAY`,
    `  >`,
    trackBlocks,
    `>`,
  ].join("\n");
}

const STATUS_COLOR = {
  idle:"transparent", queued:"#fb923c",
  generating:"#22d3ee", done:"#34d399", error:"#f87171",
};

// ── Global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Barlow+Condensed:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{overflow:hidden;background:#07070f}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#06060e}
::-webkit-scrollbar-thumb{background:#1c1c36;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#2c2c50}
.daw-item{transition:filter .12s,box-shadow .12s}
.daw-item:hover{filter:brightness(1.25)!important}
.trk-del{opacity:0;transition:opacity .15s}
.trk-hdr:hover .trk-del{opacity:1}
.item-play-btn{opacity:0;transition:opacity .15s}
.daw-item:hover .item-play-btn{opacity:1}
input,textarea{outline:none}
input[type=number]::-webkit-inner-spin-button{opacity:.5}
input[type=range]{height:3px;border-radius:2px;cursor:pointer}
input[type=range]::-webkit-slider-thumb{width:9px;height:9px}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
.anim-pulse{animation:pulse 1.3s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.anim-spin{animation:spin 1s linear infinite;display:inline-block}
`;

const field = {
  background:"#09091a", border:"1px solid #1c1c38", color:"#c0c0e0",
  padding:"6px 10px", borderRadius:4,
  fontFamily:"'IBM Plex Mono', monospace", fontSize:12, width:"100%",
};
const mkBtn = (extra = {}) => ({
  background:"#0d0d1e", border:"1px solid #232340", color:"#6868b8",
  cursor:"pointer", padding:"5px 12px", borderRadius:3,
  fontFamily:"'IBM Plex Mono', monospace", fontSize:11, letterSpacing:".5px",
  ...extra,
});

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ status, size = 6 }) {
  const color = STATUS_COLOR[status] ?? "transparent";
  return (
    <div className={status === "queued" || status === "generating" ? "anim-pulse" : ""}
      style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
        background:color, boxShadow:color !== "transparent" ? `0 0 5px ${color}` : "none" }} />
  );
}

// ── Scrubber ──────────────────────────────────────────────────────────────────
function Scrubber({ current, total, color, onSeek, thin = false }) {
  const barRef   = useRef(null);
  const dragging = useRef(false);
  const totalRef = useRef(total);
  const seekRef  = useRef(onSeek);
  useEffect(() => { totalRef.current = total;  }, [total]);
  useEffect(() => { seekRef.current  = onSeek; }, [onSeek]);

  const getTime = useCallback((clientX) => {
    if (!barRef.current) return 0;
    const r = barRef.current.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * totalRef.current;
  }, []);

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) seekRef.current(getTime(e.clientX)); };
    const onUp   = ()  => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [getTime]);

  const pct = total > 0 ? clamp((current / total) * 100, 0, 100) : 0;
  const h   = thin ? 3 : 4;
  const dot = thin ? 9 : 11;

  return (
    <div ref={barRef}
      onMouseDown={(e) => { dragging.current = true; seekRef.current(getTime(e.clientX)); }}
      style={{ flex:1, height:h, background:"#0c0c22", borderRadius:2,
        cursor:"pointer", position:"relative", margin:"0 8px", userSelect:"none" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:2 }} />
      {total > 0 && (
        <div style={{
          position:"absolute", top:"50%", left:`${pct}%`,
          transform:"translate(-50%,-50%)",
          width:dot, height:dot, borderRadius:"50%",
          background:color, boxShadow:`0 0 8px ${color}99`,
          pointerEvents:"none",
        }} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SonoFabrik() {
  const [title,        setTitle]        = useState("Untitled Song");
  const [tracks,       setTracks]       = useState(() => [
    { id:uid("track"), name:"Track 1", color:TRACK_COLORS[0], vol:1, pan:0, mute:false, solo:false, items:[] },
    { id:uid("track"), name:"Track 2", color:TRACK_COLORS[1], vol:1, pan:0, mute:false, solo:false, items:[] },
    { id:uid("track"), name:"Track 3", color:TRACK_COLORS[2], vol:1, pan:0, mute:false, solo:false, items:[] },
  ]);
  const [selected,     setSelected]     = useState(null);
  const [pps,          setPps]          = useState(80);
  const [preview,      setPreview]      = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [renderingMix,   setRenderingMix]   = useState(false);
  const [reaperExporting, setReaperExporting] = useState(false);

  const [player, setPlayer] = useState({
    itemId:null, trackId:null, playing:false, currentTime:0, duration:0,
  });
  const [mixState, setMixState] = useState({
    playing:false, loading:false, currentTime:0, duration:0,
  });

  const containerRef  = useRef(null);
  const dragRef       = useRef(null);
  const ppsRef        = useRef(pps);
  const tracksRef     = useRef(tracks);
  const audioRef      = useRef(null);
  const mixCtxRef       = useRef(null);
  // Decoded cache now stores {trackId, itemId, buf} — no stale item snapshot
  const mixDecodedRef   = useRef([]);
  const mixSourcesRef   = useRef([]);
  // One persistent GainNode per track — allows instant mute/solo/vol while playing
  const mixTrackGainsRef = useRef({});
  const mixStartRef     = useRef(0);
  const mixRafRef       = useRef(null);
  const mixPlayingRef   = useRef(false);
  const mixStateRef     = useRef(mixState);

  useEffect(() => { ppsRef.current    = pps;    }, [pps]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { mixStateRef.current = mixState; }, [mixState]);

  const TIME_W = TOTAL_SECS * pps;

  // ── Track / item mutations ────────────────────────────────────────────────
  const mutTracks = (fn) => setTracks(prev => fn(prev));

  const mutTrack = useCallback((tid, patch) =>
    setTracks(prev => prev.map(t => t.id !== tid ? t : { ...t, ...patch })), []);

  // Instantly apply vol/mute/solo to any live GainNodes without restarting playback
  const applyLiveGains = useCallback((tracksArray) => {
    const gainMap = mixTrackGainsRef.current;
    if (!gainMap || !Object.keys(gainMap).length) return;
    const ctx      = mixCtxRef.current;
    const anySolo  = tracksArray.some(t => t.solo);
    const rampTime = 0.012; // 12 ms ramp — avoids clicks, imperceptible latency
    for (const t of tracksArray) {
      const node = gainMap[t.id];
      if (!node) continue;
      const effMuted  = t.mute || (anySolo && !t.solo);
      const targetGain = effMuted ? 0 : (t.vol ?? 1);
      if (ctx) {
        node.gain.setTargetAtTime(targetGain, ctx.currentTime, rampTime);
      } else {
        node.gain.value = targetGain;
      }
    }
  }, []);

  // mutTrackLive: updates state AND immediately adjusts live audio gains
  const mutTrackLive = useCallback((tid, patch) => {
    setTracks(prev => {
      const next = prev.map(t => t.id !== tid ? t : { ...t, ...patch });
      applyLiveGains(next);
      return next;
    });
  }, [applyLiveGains]);

  const mutItem = useCallback((tid, iid, patch) =>
    setTracks(prev => prev.map(t =>
      t.id !== tid ? t : { ...t, items:t.items.map(i => i.id !== iid ? i : { ...i, ...patch }) }
    )), []);

  const clampItemLength = useCallback((length, begin = 0) =>
    +clamp(length, 0.1, Math.min(MAX_ITEM_SECS, Math.max(0.1, TOTAL_SECS - begin))).toFixed(3), []);

  const addTrack = () => {
    const n = tracksRef.current.length;
    mutTracks(prev => [...prev, {
      id:uid("track"), name:`Track ${n+1}`,
      color:TRACK_COLORS[n % TRACK_COLORS.length],
      vol:1, pan:0, mute:false, solo:false, items:[],
    }]);
  };

  const delTrack = (tid) => {
    mutTracks(prev => prev.filter(t => t.id !== tid));
    if (selected?.trackId === tid) setSelected(null);
  };

  const delItem = useCallback((tid, iid) => {
    setTracks(prev => prev.map(t =>
      t.id !== tid ? t : { ...t, items:t.items.filter(i => i.id !== iid) }
    ));
    setSelected(s => s?.itemId === iid ? null : s);
  }, []);

  const selTrack = selected ? tracks.find(t => t.id === selected.trackId) : null;
  const selItem  = selTrack  ? selTrack.items.find(i => i.id === selected.itemId) : null;

  // ── Generation ────────────────────────────────────────────────────────────
  const generateItem = useCallback(async (trackId, itemId) => {
    const track = tracksRef.current.find(t => t.id === trackId);
    const item  = track?.items.find(i => i.id === itemId);
    if (!item || !item.prompt.trim()) return;
    if (item.length > MAX_ITEM_SECS) {
      mutItem(trackId, itemId, { status:"error", error:`Max length is ${MAX_ITEM_SECS}s` });
      return;
    }
    mutItem(trackId, itemId, { status:"queued", error:null });
    try {
      const res = await fetch(`${SERVER}/generate`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          item_id:             itemId,
          prompt:              item.prompt,
          length:              item.length,
          negative_prompt:     item.negPrompt  || "",
          num_inference_steps: item.numSteps   ?? DEFAULT_STEPS,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        mutItem(trackId, itemId, { status:"error", error:err.error || "Request failed" });
      }
    } catch {
      mutItem(trackId, itemId, { status:"error", error:"Server unreachable" });
    }
  }, [mutItem]);

  // ── Status polling ────────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      const pairs = tracksRef.current.flatMap(t =>
        t.items
          .filter(i => i.status === "queued" || i.status === "generating")
          .map(i => ({ trackId:t.id, item:i }))
      );
      for (const { trackId, item } of pairs) {
        try {
          const d = await (await fetch(`${SERVER}/status/${item.id}`)).json();
          if (d.status !== item.status) {
            const patch = { status:d.status, error:d.error ?? null };
            if (d.status === "done") patch.audioVersion = Date.now();
            mutItem(trackId, item.id, patch);
          }
        } catch {}
      }
    };
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [mutItem]);

  // ── Server health ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try   { setServerOnline((await fetch(`${SERVER}/health`)).ok); }
      catch { setServerOnline(false); }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, []);

  // ── Single-clip HTML <audio> ──────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime  = () => setPlayer(p => ({ ...p, currentTime:el.currentTime }));
    const onMeta  = () => setPlayer(p => ({ ...p, duration:el.duration }));
    const onEnded = () => setPlayer(p => ({ ...p, playing:false }));
    el.addEventListener("timeupdate",     onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended",          onEnded);
    return () => {
      el.removeEventListener("timeupdate",     onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended",          onEnded);
    };
  }, []);

  const loadInPlayer = useCallback((trackId, itemId) => {
    const el    = audioRef.current;
    if (!el) return;
    const track = tracksRef.current.find(t => t.id === trackId);
    const item  = track?.items.find(i => i.id === itemId);
    el.src = audioUrl(itemId, item?.audioVersion);
    el.load();
    el.play().catch(() => {});
    setPlayer({ itemId, trackId, playing:true, currentTime:0, duration:0 });
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !player.itemId) return;
    if (player.playing) { el.pause(); setPlayer(p => ({ ...p, playing:false })); }
    else                { el.play().catch(() => {}); setPlayer(p => ({ ...p, playing:true })); }
  }, [player.playing, player.itemId]);

  const seekTo = useCallback((time) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = time;
    setPlayer(p => ({ ...p, currentTime:time }));
  }, []);

  // ── Web Audio mix player ──────────────────────────────────────────────────
  const stopMixSources = useCallback(() => {
    for (const src of mixSourcesRef.current) { try { src.stop(0); } catch {} }
    mixSourcesRef.current  = [];
    mixTrackGainsRef.current = {};
    if (mixRafRef.current) { cancelAnimationFrame(mixRafRef.current); mixRafRef.current = null; }
    mixPlayingRef.current = false;
  }, []);

  const startRaf = useCallback((totalDur) => {
    const tick = () => {
      if (!mixPlayingRef.current || !mixCtxRef.current) return;
      const t = Math.min(mixCtxRef.current.currentTime - mixStartRef.current, totalDur);
      setMixState(s => ({ ...s, currentTime:t }));
      if (t >= totalDur) {
        mixPlayingRef.current = false;
        mixSourcesRef.current = [];
        setMixState(s => ({ ...s, playing:false, currentTime:0 }));
        return;
      }
      mixRafRef.current = requestAnimationFrame(tick);
    };
    mixRafRef.current = requestAnimationFrame(tick);
  }, []);

  // scheduleMixFrom: always reads live positions from tracksRef.
  // Each track gets ONE persistent GainNode so mute/solo/vol changes take effect
  // instantly via applyLiveGains() without restarting sources.
  const scheduleMixFrom = useCallback((offset, decoded, _ignoredDur) => {
    const ctx = mixCtxRef.current;
    if (!ctx || !decoded.length) return;
    stopMixSources();

    // Live lookup tables
    const liveItems  = {};
    const liveTracks = {};
    for (const t of tracksRef.current) {
      liveTracks[t.id] = t;
      for (const i of t.items) liveItems[i.id] = { ...i };
    }

    const anySolo = Object.values(liveTracks).some(t => t.solo);

    // Create ONE GainNode per track — these persist for the duration of playback
    const newTrackGains = {};
    for (const { trackId } of decoded) {
      if (newTrackGains[trackId] || !liveTracks[trackId]) continue;
      const lTrack    = liveTracks[trackId];
      const effMuted  = lTrack.mute || (anySolo && !lTrack.solo);
      const gain      = ctx.createGain();
      gain.gain.value = effMuted ? 0 : (lTrack.vol ?? 1);
      gain.connect(ctx.destination);
      newTrackGains[trackId] = gain;
    }
    mixTrackGainsRef.current = newTrackGains;

    // Recalculate total duration from current positions
    const totalDur = Math.max(0.1, ...decoded.map(({ itemId, buf }) => {
      const live = liveItems[itemId];
      return live ? live.begin + buf.duration : buf.duration;
    }));

    const now = ctx.currentTime + 0.05;
    mixStartRef.current = now - offset;

    const sources = [];
    for (const { trackId, itemId, buf } of decoded) {
      const live      = liveItems[itemId];
      const trackGain = newTrackGains[trackId];
      const lTrack    = liveTracks[trackId];
      if (!live || !trackGain || !lTrack) continue;

      const begin   = live.begin;   // always current position
      const pan     = lTrack.pan ?? 0;
      const itemEnd = begin + buf.duration;
      if (itemEnd <= offset) continue;

      // Route: BufferSource → StereoPanner(pan) → TrackGain(vol/mute) → destination
      const panner = ctx.createStereoPanner
        ? ctx.createStereoPanner()
        : (() => { const m = ctx.createPanner(); m.panningModel = "equalpower"; return m; })();
      if (panner.pan) panner.pan.value = pan;

      const src   = ctx.createBufferSource();
      src.buffer  = buf;
      src.connect(panner);
      panner.connect(trackGain);          // ← persistent track gain node

      const when   = Math.max(now, now + (begin - offset));
      const srcOff = Math.max(0, offset - begin);
      const dur    = itemEnd - Math.max(begin, offset);
      src.start(when, srcOff, dur);
      sources.push(src);
    }
    mixSourcesRef.current = sources;
    mixPlayingRef.current = true;

    setMixState(s => ({ ...s, playing:true, duration:totalDur, currentTime:offset }));
    startRaf(totalDur);
  }, [stopMixSources, startRaf]);

  const loadAndPlayMix = useCallback(async () => {
    const donePairs = tracksRef.current.flatMap(t =>
      t.items.filter(i => i.status === "done").map(i => ({ track:t, item:i }))
    );
    if (!donePairs.length) return;

    setMixState(s => ({ ...s, loading:true }));

    if (!mixCtxRef.current || mixCtxRef.current.state === "closed")
      mixCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    await mixCtxRef.current.resume();

    try {
      // Store {trackId, itemId, buf} — no positional snapshot so moves take effect
      const decoded = await Promise.all(donePairs.map(async ({ track, item }) => {
        const r   = await fetch(audioUrl(item.id, item.audioVersion));
        const ab  = await r.arrayBuffer();
        const buf = await mixCtxRef.current.decodeAudioData(ab);
        return { trackId:track.id, itemId:item.id, buf };
      }));
      mixDecodedRef.current = decoded;
      // totalDur computed fresh in scheduleMixFrom
      setMixState(s => ({ ...s, loading:false }));
      scheduleMixFrom(0, decoded, 0);
    } catch (err) {
      console.error("Mix load error:", err);
      setMixState(s => ({ ...s, loading:false }));
    }
  }, [scheduleMixFrom]);

  const toggleMix = useCallback(() => {
    if (mixState.loading) return;
    if (mixState.playing) {
      const t = mixCtxRef.current ? mixCtxRef.current.currentTime - mixStartRef.current : 0;
      stopMixSources();
      setMixState(s => ({ ...s, playing:false, currentTime:Math.max(0, t) }));
    } else if (mixDecodedRef.current.length > 0) {
      if (!mixCtxRef.current || mixCtxRef.current.state === "closed")
        mixCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      mixCtxRef.current.resume().then(() =>
        scheduleMixFrom(
          mixStateRef.current.currentTime,
          mixDecodedRef.current,
          mixStateRef.current.duration,
        )
      );
    } else {
      loadAndPlayMix();
    }
  }, [mixState.loading, mixState.playing, stopMixSources, scheduleMixFrom, loadAndPlayMix]);

  const seekMix = useCallback((t) => {
    setMixState(s => ({ ...s, currentTime:t }));
    if (mixPlayingRef.current)
      scheduleMixFrom(t, mixDecodedRef.current, mixStateRef.current.duration);
  }, [scheduleMixFrom]);

  const reloadMix = useCallback(() => {
    stopMixSources();
    mixDecodedRef.current = [];
    setMixState({ playing:false, loading:false, currentTime:0, duration:0 });
  }, [stopMixSources]);

  // ── Download single WAV ───────────────────────────────────────────────────
  const downloadItem = useCallback(async (trackId, itemId) => {
    const track = tracksRef.current.find(t => t.id === trackId);
    const item  = track?.items.find(i => i.id === itemId);
    if (!item || item.status !== "done") return;
    try {
      const res  = await fetch(audioUrl(item.id, item.audioVersion));
      if (!res.ok) return;
      const blob = await res.blob();
      const safeName = (item.name || item.id).replace(/[/\\?%*:|"<>]/g, "_");
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href:url, download:`${safeName}.wav`,
      }).click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error("Download failed:", err); }
  }, []);

  // ── Server render mix ─────────────────────────────────────────────────────
  const renderMix = async () => {
    const doneItems = tracks.flatMap(t => t.items.filter(i => i.status === "done"));
    if (!doneItems.length) return;
    setRenderingMix(true);
    const anySolo = tracks.some(t => t.solo);
    try {
      const res = await fetch(`${SERVER}/mix`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          song_data: {
            song: {
              title,
              tracks: tracks
                .filter(t => !t.mute && (!anySolo || t.solo))
                .map(t => ({
                  id:t.id, name:t.name,
                  volume: t.vol ?? 1,
                  pan:    t.pan ?? 0,
                  items: t.items
                    .filter(i => i.status === "done")
                    .sort((a, b) => a.begin - b.begin)
                    .map(i => ({ id:i.id, begin:i.begin, length:i.length })),
                }))
                .filter(t => t.items.length > 0),
            },
          },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), {
          href:url,
          download:`${title.replace(/\s+/g,"_").toLowerCase()}_mix.wav`,
        }).click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error(e); }
    setRenderingMix(false);
  };

  // ── Timeline drag ─────────────────────────────────────────────────────────
  const onRowMouseDown = useCallback((e, trackId) => {
    if (e.button !== 0) return;
    const itemEl = e.target.closest("[data-iid]");
    const scroll = containerRef.current?.scrollLeft ?? 0;

    if (itemEl) {
      const itemId = itemEl.dataset.iid;
      const tr = tracksRef.current.find(t => t.id === trackId);
      const it = tr?.items.find(i => i.id === itemId);
      if (!it) return;
      e.preventDefault();
      setSelected({ trackId, itemId });
      dragRef.current = { mode:"move", trackId, itemId, cx:e.clientX, ob:it.begin, sl:scroll };
    } else {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      // rect.left is viewport-relative and already incorporates scrollLeft —
      // do NOT add scroll again, that was the double-counting bug.
      const s0   = snap(clamp((e.clientX - rect.left) / ppsRef.current, 0, TOTAL_SECS - 0.1));
      dragRef.current = { mode:"create", trackId, cx:e.clientX, s0, sl:scroll };
      setPreview({ trackId, begin:s0, length:0.1 });
      setSelected(null);
    }
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.cx + ((containerRef.current?.scrollLeft ?? 0) - d.sl);
      const ds = dx / ppsRef.current;
      if (d.mode === "move") {
        mutItem(d.trackId, d.itemId,
          { begin:+snap(clamp(d.ob + ds, 0, TOTAL_SECS - 0.1)).toFixed(3) });
      } else {
        const maxEnd = Math.min(TOTAL_SECS, d.s0 + MAX_ITEM_SECS);
        const length = +(snap(clamp(d.s0 + ds, d.s0 + 0.1, maxEnd)) - d.s0).toFixed(3);
        setPreview({ trackId:d.trackId, begin:d.s0, length });
      }
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "create") {
        const dx     = e.clientX - d.cx + ((containerRef.current?.scrollLeft ?? 0) - d.sl);
        const maxEnd = Math.min(TOTAL_SECS, d.s0 + MAX_ITEM_SECS);
        const length = +(snap(clamp(d.s0 + dx / ppsRef.current, d.s0 + 0.1, maxEnd)) - d.s0).toFixed(3);
        if (length >= 0.25) {
          const id = uid("item");
          setTracks(prev => prev.map(t =>
            t.id !== d.trackId ? t : {
              ...t,
              items:[...t.items, {
                id, begin:d.s0, length,
                name:"",
                prompt:"", negPrompt:"",
                numSteps:DEFAULT_STEPS,
                status:"idle", error:null, audioVersion:null,
              }],
            }
          ));
          setSelected({ trackId:d.trackId, itemId:id });
        }
      }
      dragRef.current = null;
      setPreview(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [mutItem]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace")
        if (selected) delItem(selected.trackId, selected.itemId);
      if (e.key === "Escape") setSelected(null);
      if (e.key === " ") {
        e.preventDefault();
        if (mixDecodedRef.current.length > 0 || mixState.playing) toggleMix();
        else togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, delItem, togglePlay, toggleMix, mixState.playing]);

  // ── Export ────────────────────────────────────────────────────────────────
  const buildSongData = () => {
    let n = 0;
    return {
      song: {
        title,
        tracks: tracks.map((t, ti) => ({
          id:`track_${ti+1}`, name:t.name,
          volume: t.vol ?? 1,
          pan:    t.pan ?? 0,
          items: [...t.items].sort((a, b) => a.begin - b.begin).map(it => ({
            id:`item_${++n}`, begin:it.begin, length:it.length, prompt:it.prompt,
            ...(it.negPrompt                  ? { negative_prompt:it.negPrompt }        : {}),
            ...(it.numSteps !== DEFAULT_STEPS ? { num_inference_steps:it.numSteps }     : {}),
          })),
        })),
      },
    };
  };

  const download = (content, filename, type = "application/json") => {
    const a = Object.assign(document.createElement("a"), {
      href:URL.createObjectURL(new Blob([content], { type })), download:filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportJSON   = () =>
    download(JSON.stringify(buildSongData(), null, 2),
      `${title.replace(/\s+/g,"_").toLowerCase()}.json`);

  const exportPython = () => {
    const data  = buildSongData();
    const items = data.song.tracks.flatMap(t => t.items);
    const slug  = title.replace(/\s+/g,"_").toLowerCase();
    const lines = [
      `"""`, `Auto-generated runner for "${title}"`,
      `Requires: generate_audio.py + mix_audio.py`, `"""\n`,
      `import json`,
      `from generate_audio import generate_audio, load_model`,
      `from mix_audio import mix_song\n`,
      `SONG = json.loads(r"""`, JSON.stringify(data, null, 2), `""")\n`,
      `with open("${slug}.json", "w") as f:\n    json.dump(SONG, f, indent=2)\n`,
      `pipe, device = load_model()`,
      ...items.map(it => [
        ``, `# ${it.id}  begin=${it.begin}s  length=${it.length}s`,
        `generate_audio(`,
        `    prompt=${JSON.stringify(it.prompt)},`,
        ...(it.negative_prompt     ? [`    negative_prompt=${JSON.stringify(it.negative_prompt)},`] : []),
        ...(it.num_inference_steps ? [`    num_inference_steps=${it.num_inference_steps},`]         : []),
        `    length=${it.length}, output_file="${it.id}.wav",`,
        `    pipe=pipe, device=device,`,
        `)`,
        `print("  ✓  ${it.id}.wav")`,
      ].join("\n")),
      `\nmix_song("${slug}.json", output_file="${slug}_mix.wav")`,
    ];
    download(lines.join("\n"), `run_${slug}.py`, "text/plain");
  };

  const exportReaper = async () => {
    const doneCount = tracks.reduce((n, t) =>
      n + t.items.filter(i => i.status === "done").length, 0);
    if (!doneCount) return;

    setReaperExporting(true);
    try {
      const slug     = title.replace(/\s+/g, "_").toLowerCase();
      const rppText  = buildRpp(title, tracks);
      const zip      = new JSZip();
      const folder   = zip.folder(slug);
      const media    = folder.folder("Media");

      // Add the .rpp project file
      folder.file(`${slug}.rpp`, rppText);

      // Fetch every done WAV and add to Media/
      const donePairs = tracks.flatMap(t =>
        t.items.filter(i => i.status === "done").map(i => ({ track:t, item:i }))
      );
      await Promise.all(donePairs.map(async ({ item }) => {
        const res = await fetch(audioUrl(item.id, item.audioVersion));
        if (!res.ok) throw new Error(`Failed to fetch ${item.id}.wav`);
        const blob = await res.blob();
        media.file(`${item.id}.wav`, blob);
      }));

      const zipBlob = await zip.generateAsync({ type:"blob", compression:"DEFLATE" });
      const url     = URL.createObjectURL(zipBlob);
      Object.assign(document.createElement("a"), {
        href:url, download:`${slug}_reaper.zip`,
      }).click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("REAPER export failed:", err);
    }
    setReaperExporting(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const tickStep   = pps >= 80 ? 1 : pps >= 40 ? 2 : pps >= 20 ? 4 : 8;
  const ticks      = Array.from({ length:Math.floor(TOTAL_SECS / tickStep)+1 }, (_, i) => i * tickStep);
  const totalItems = tracks.reduce((s, t) => s + t.items.length, 0);
  const doneCount  = tracks.reduce((s, t) => s + t.items.filter(i => i.status === "done").length, 0);

  const playerTrack = player.trackId ? tracks.find(t => t.id === player.trackId) : null;
  const playerItem  = playerTrack?.items.find(i => i.id === player.itemId);
  const showPlayhead = mixState.duration > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'IBM Plex Mono', monospace", background:"#07070f",
      color:"#b0b0d0", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <audio ref={audioRef} />

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"0 14px",
        background:"#0a0a1c", borderBottom:"1px solid #161630", flexShrink:0, height:50 }}>
        <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
          fontSize:16, color:"#4444bb", letterSpacing:3.5, textTransform:"uppercase",
          whiteSpace:"nowrap", userSelect:"none" }}>◈ SONOFABRIK</div>
        <div style={{ width:1, height:24, background:"#161630", flexShrink:0 }} />
        <span style={{ fontSize:9.5, color:"#333355", letterSpacing:1.5 }}>TITLE</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...field, width:200, padding:"4px 9px", fontSize:13 }} />
        <div style={{ flex:1 }} />
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10,
          color:serverOnline ? "#34d399" : "#3a3a5a" }}>
          <div style={{ width:6, height:6, borderRadius:"50%",
            background:serverOnline ? "#34d399" : "#202038",
            boxShadow:serverOnline ? "0 0 6px #34d399" : "none" }} />
          {serverOnline ? "ONLINE" : "OFFLINE"}
        </div>
        <div style={{ width:1, height:24, background:"#161630", flexShrink:0 }} />
        <span style={{ fontSize:9.5, color:"#333355", letterSpacing:1 }}>ZOOM</span>
        <button style={mkBtn()} onClick={() => setPps(p => clamp(p - 20, 20, 240))}>−</button>
        <span style={{ fontSize:12, minWidth:28, textAlign:"center", color:"#6666aa" }}>{pps}</span>
        <button style={mkBtn()} onClick={() => setPps(p => clamp(p + 20, 20, 240))}>+</button>
        <div style={{ width:1, height:24, background:"#161630", flexShrink:0 }} />
        <button onClick={exportPython}
          style={mkBtn({ color:"#44aa88", borderColor:"#162820" })}
          onMouseEnter={e => { e.currentTarget.style.borderColor="#44aa88"; e.currentTarget.style.color="#66ccaa"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="#162820"; e.currentTarget.style.color="#44aa88"; }}
        >⬇ Python</button>
        <button onClick={exportJSON}
          style={mkBtn({ color:"#8877dd", borderColor:"#201c44", background:"#0e0e22" })}
          onMouseEnter={e => { e.currentTarget.style.borderColor="#8877dd"; e.currentTarget.style.color="#aaa0ff"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="#201c44"; e.currentTarget.style.color="#8877dd"; }}
        >⬇ JSON</button>
        <button
          onClick={exportReaper}
          disabled={reaperExporting || doneCount === 0}
          style={mkBtn({
            color:       (!reaperExporting && doneCount > 0) ? "#fb923c" : "#2a2a44",
            borderColor: (!reaperExporting && doneCount > 0) ? "#3a1a0a" : "#1a1a28",
            background:  "#0e0808",
            opacity:     (!reaperExporting && doneCount > 0) ? 1 : 0.4,
            cursor:      (!reaperExporting && doneCount > 0) ? "pointer" : "not-allowed",
          })}
          onMouseEnter={e => { if (!reaperExporting && doneCount > 0) e.currentTarget.style.borderColor="#fb923c"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = (!reaperExporting && doneCount > 0) ? "#3a1a0a" : "#1a1a28"; }}
        >{reaperExporting
            ? <span className="anim-spin">⟳</span>
            : "⬇"
          } REAPER</button>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── TIMELINE ─────────────────────────────────────────────────── */}
        <div ref={containerRef} style={{ flex:1, overflow:"auto" }}>
          <div style={{ minWidth:SIDEBAR_W + TIME_W + 40, position:"relative" }}>

            {/* Ruler */}
            <div style={{ display:"flex", position:"sticky", top:0, zIndex:20,
              height:RULER_H, background:"#0a0a1c", borderBottom:"1px solid #141428" }}>
              <div style={{ width:SIDEBAR_W, flexShrink:0, position:"sticky", left:0, zIndex:21,
                background:"#0a0a1c", borderRight:"1px solid #141428",
                display:"flex", alignItems:"center", paddingLeft:14 }}>
                <span style={{ fontSize:9.5, color:"#2a2a50", letterSpacing:1 }}>
                  {tracks.length} TRK · {totalItems} ITEMS
                </span>
              </div>
              <div style={{ position:"relative", width:TIME_W, flexShrink:0 }}>
                {ticks.map(s => {
                  const major = s % (tickStep * 4) === 0;
                  return (
                    <div key={s} style={{ position:"absolute", left:s*pps, top:0, height:"100%" }}>
                      <div style={{ paddingTop:6, paddingLeft:3, fontSize:9,
                        color:major ? "#5555aa" : "#252548", whiteSpace:"nowrap" }}>{s}s</div>
                      <div style={{ position:"absolute", left:0, bottom:0, width:1,
                        height:major?11:6, background:major?"#252548":"#141428" }} />
                    </div>
                  );
                })}
                {showPlayhead && (
                  <div style={{ position:"absolute", left:mixState.currentTime*pps, top:0,
                    width:2, height:"100%", background:"#ffffff55", pointerEvents:"none", zIndex:5 }} />
                )}
              </div>
            </div>

            {/* Track rows */}
            {tracks.map((track, ti) => (
              <div key={track.id} style={{ display:"flex", height:TRACK_H, borderBottom:"1px solid #0d0d1e" }}>

                {/* ── Track header with vol/pan ──────────────────────── */}
                <div className="trk-hdr" style={{ width:SIDEBAR_W, flexShrink:0,
                  position:"sticky", left:0, zIndex:10, background:"#0a0a1c",
                  borderRight:"1px solid #141428",
                  display:"flex", flexDirection:"column", justifyContent:"center",
                  padding:"0 8px 0 10px", gap:5 }}>

                  {/* Row 1: color bar + name + [M][S] + delete */}
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:3, height:30, borderRadius:2, flexShrink:0,
                      background:track.color, boxShadow:`0 0 8px ${track.color}50` }} />
                    <input value={track.name}
                      onChange={e => mutTrack(track.id, { name:e.target.value })}
                      style={{ flex:1, background:"transparent", border:"none", color:"#d0d0f0",
                        fontFamily:"'Barlow Condensed', sans-serif", fontWeight:500, fontSize:14,
                        minWidth:0 }} />
                    {/* Mute */}
                    <button
                      onClick={() => mutTrackLive(track.id, { mute:!track.mute })}
                      title="Mute"
                      style={{
                        flexShrink:0, width:20, height:20, padding:0, borderRadius:3,
                        border:`1px solid ${track.mute ? "#fb923c88" : "#1a1a30"}`,
                        background: track.mute ? "#1a0c00" : "transparent",
                        color:      track.mute ? "#fb923c"  : "#2a2a48",
                        cursor:"pointer", fontSize:9, fontWeight:700, letterSpacing:.5,
                        fontFamily:"'IBM Plex Mono', monospace",
                        transition:"color .12s, border-color .12s, background .12s",
                      }}
                      onMouseEnter={e => { if (!track.mute) { e.currentTarget.style.color="#fb923c"; e.currentTarget.style.borderColor="#fb923c55"; }}}
                      onMouseLeave={e => { if (!track.mute) { e.currentTarget.style.color="#2a2a48"; e.currentTarget.style.borderColor="#1a1a30"; }}}
                    >M</button>
                    {/* Solo */}
                    <button
                      onClick={() => mutTrackLive(track.id, { solo:!track.solo })}
                      title="Solo"
                      style={{
                        flexShrink:0, width:20, height:20, padding:0, borderRadius:3,
                        border:`1px solid ${track.solo ? track.color + "aa" : "#1a1a30"}`,
                        background: track.solo ? track.color + "22" : "transparent",
                        color:      track.solo ? track.color          : "#2a2a48",
                        cursor:"pointer", fontSize:9, fontWeight:700, letterSpacing:.5,
                        fontFamily:"'IBM Plex Mono', monospace",
                        transition:"color .12s, border-color .12s, background .12s",
                      }}
                      onMouseEnter={e => { if (!track.solo) { e.currentTarget.style.color=track.color; e.currentTarget.style.borderColor=track.color+"55"; }}}
                      onMouseLeave={e => { if (!track.solo) { e.currentTarget.style.color="#2a2a48"; e.currentTarget.style.borderColor="#1a1a30"; }}}
                    >S</button>
                    <button className="trk-del" onClick={() => delTrack(track.id)}
                      style={{ background:"none", border:"none", color:"#331133",
                        cursor:"pointer", fontSize:17, lineHeight:1, padding:"0 1px", flexShrink:0 }}
                      onMouseEnter={e => e.currentTarget.style.color="#cc3355"}
                      onMouseLeave={e => e.currentTarget.style.color="#331133"}>×</button>
                  </div>

                  {/* Row 2: vol + pan sliders */}
                  <div style={{ display:"flex", gap:4, width:"100%", flexDirection:"column" }}>

                    {/* Volume */}
                    <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, width: "100%" }}>
                      <span style={{ fontSize:8.5, color:"#2a2a50", letterSpacing:.5, flexShrink:0,
                        width:10, textAlign:"center" }}>V</span>
                      <input type="range" min={0} max={1} step={0.01}
                        value={track.vol ?? 1}
                        onChange={e => mutTrackLive(track.id, { vol:+e.target.value })}
                        style={{ flex:1, accentColor:track.color, minWidth:0 }} />
                      <span style={{ fontSize:8.5, color:track.color + "cc", minWidth:26,
                        textAlign:"right", letterSpacing:.3 }}>
                        {fmtVol(track.vol ?? 1)}
                      </span>
                    </div>

                    {/* Pan */}
                    <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, width: "100%" }}>
                      <span style={{ fontSize:8.5, color:"#2a2a50", letterSpacing:.5, flexShrink:0,
                        width:10, textAlign:"center" }}>P</span>
                      <input type="range" min={-1} max={1} step={0.01}
                        value={track.pan ?? 0}
                        onChange={e => mutTrack(track.id, { pan:+e.target.value })}
                        style={{ flex:1, accentColor:track.color, minWidth:0 }} />
                      <span style={{ fontSize:8.5,
                        color:(track.pan ?? 0) === 0 ? "#3a3a5a" : track.color + "cc",
                        minWidth:26, textAlign:"right", letterSpacing:.3 }}>
                        {fmtPan(track.pan ?? 0)}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Timeline row */}
                <div style={{ width:TIME_W, flexShrink:0, position:"relative",
                  background:ti%2===0?"#08081a":"#060614", cursor:"crosshair" }}
                  onMouseDown={e => onRowMouseDown(e, track.id)}>

                  {ticks.map(s => (
                    <div key={s} style={{ position:"absolute", left:s*pps, top:0, width:1,
                      height:"100%", background:s%(tickStep*4)===0?"#131326":"#0c0c1a",
                      pointerEvents:"none" }} />
                  ))}

                  {showPlayhead && (
                    <div style={{ position:"absolute", left:mixState.currentTime*pps, top:0,
                      width:1, height:"100%", background:"#ffffff22",
                      pointerEvents:"none", zIndex:8 }} />
                  )}

                  {/* Items */}
                  {(() => {
                    const anySolo    = tracks.some(t => t.solo);
                    const isEffMuted = track.mute || (anySolo && !track.solo);
                    return track.items.map(item => {
                    const isSel     = selected?.itemId === item.id;
                    const isPlaying = player.itemId    === item.id;
                    const w = Math.max(6, item.length * pps);
                    const topColor =
                      item.status === "generating" ? "#22d3ee" :
                      item.status === "queued"     ? "#fb923c" :
                      item.status === "error"      ? "#f87171" : track.color;
                    // Name takes priority over prompt in display
                    const label = item.name || item.prompt || null;

                    return (
                      <div key={item.id} className="daw-item" data-iid={item.id}
                        onClick={e => { e.stopPropagation(); setSelected({ trackId:track.id, itemId:item.id }); }}
                        style={{
                          position:"absolute", left:item.begin*pps, width:w,
                          top:10, height:TRACK_H-20,
                          background:`${track.color}1c`,
                          border:`1px solid ${isSel ? track.color :
                            item.status==="error" ? "#f8717150" : track.color+"50"}`,
                          borderRadius:4, cursor:"grab", overflow:"hidden",
                          boxShadow:isPlaying ? `0 0 12px ${track.color}70` :
                                    isSel     ? `0 0 14px ${track.color}40, inset 0 1px 0 ${track.color}80` : "none",
                          opacity: isEffMuted
                            ? 0.28
                            : 0.55 + (track.vol ?? 1) * 0.45,
                          transition:"opacity .15s",
                        }}>
                        <div style={{ height:2, background:topColor, opacity:isSel?1:0.6 }} />
                        <div style={{ padding:"3px 6px" }}>
                          <div style={{ fontSize:8.5, color:track.color+"90", marginBottom:2, whiteSpace:"nowrap" }}>
                            {item.begin.toFixed(2)}s › {(item.begin+item.length).toFixed(2)}s
                          </div>
                          {w > 44 && (
                            <div style={{ fontSize:10,
                              color: item.name ? track.color+"dd" : "#6868a0",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:w-12,
                              fontStyle: label ? "normal" : "italic",
                              fontWeight: item.name ? 600 : 400 }}>
                              {item.status==="generating" ? "⟳ generating…" :
                               item.status==="queued"     ? "· queued" :
                               item.status==="error"      ? "✕ error" :
                               label || "no prompt"}
                            </div>
                          )}
                        </div>
                        {item.status !== "idle" && (
                          <div style={{ position:"absolute", top:6, right:5 }}>
                            <StatusDot status={item.status} />
                          </div>
                        )}
                        {item.status === "done" && w > 32 && (
                          <div className="item-play-btn"
                            onClick={e => { e.stopPropagation(); loadInPlayer(track.id, item.id); }}
                            style={{ position:"absolute", bottom:5, right:5,
                              width:18, height:18, borderRadius:"50%",
                              background:`${track.color}22`, border:`1px solid ${track.color}88`,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:8, color:track.color, cursor:"pointer" }}>▶</div>
                        )}
                      </div>
                    );
                  });
                  })()}

                  {preview?.trackId === track.id && (
                    <div style={{ position:"absolute", left:preview.begin*pps,
                      width:Math.max(2, preview.length*pps),
                      top:10, height:TRACK_H-20,
                      background:`${track.color}0e`, border:`1px dashed ${track.color}44`,
                      borderRadius:4, pointerEvents:"none" }} />
                  )}
                </div>
              </div>
            ))}

            {/* Add track */}
            <div style={{ display:"flex", height:46 }}>
              <div style={{ width:SIDEBAR_W, flexShrink:0, position:"sticky", left:0, zIndex:10,
                background:"#0a0a1c", borderRight:"1px solid #141428",
                display:"flex", alignItems:"center", padding:"0 10px" }}>
                <button onClick={addTrack}
                  style={mkBtn({ width:"100%", textAlign:"center", padding:"7px", letterSpacing:1.5 })}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#3c3caa"; e.currentTarget.style.color="#aaaaee"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#232340"; e.currentTarget.style.color="#6868b8"; }}
                >+ ADD TRACK</button>
              </div>
            </div>

          </div>
        </div>

        {/* ── INSPECTOR ────────────────────────────────────────────────── */}
        <div style={{ width:selItem?284:0, overflow:"hidden",
          transition:"width .2s ease", flexShrink:0,
          borderLeft:"1px solid #141428", background:"#0a0a1c" }}>
          {selItem && selTrack && (
            <div style={{ width:284, padding:16, display:"flex", flexDirection:"column",
              gap:12, height:"100%", overflowY:"auto" }}>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:12,
                  fontWeight:600, color:selTrack.color, letterSpacing:2.5, textTransform:"uppercase" }}>
                  ◈ Inspector
                </span>
                <button onClick={() => setSelected(null)}
                  style={{ background:"none", border:"none", color:"#2a2a50", cursor:"pointer", fontSize:19 }}
                  onMouseEnter={e => e.currentTarget.style.color="#8866aa"}
                  onMouseLeave={e => e.currentTarget.style.color="#2a2a50"}>×</button>
              </div>

              <div style={{ height:1, background:"#141428" }} />

              <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"#404068" }}>
                <div style={{ width:8, height:8, borderRadius:2, background:selTrack.color,
                  boxShadow:`0 0 5px ${selTrack.color}66` }} />
                {selTrack.name}
              </div>

              {/* Item name */}
              <label style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>NAME</span>
                <input
                  value={selItem.name || ""}
                  onChange={e => mutItem(selected.trackId, selected.itemId, { name:e.target.value })}
                  placeholder="Optional — used for WAV filename…"
                  style={field}
                />
              </label>

              {/* Begin */}
              <label style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>BEGIN (s)</span>
                <input type="number" min={0} max={TOTAL_SECS-0.1} step={0.1}
                  value={selItem.begin}
                  onChange={e => {
                    const begin  = +clamp(parseFloat(e.target.value||"0"), 0, TOTAL_SECS-0.1).toFixed(3);
                    const length = clampItemLength(selItem.length, begin);
                    mutItem(selected.trackId, selected.itemId, { begin, length });
                  }}
                  style={field} />
              </label>

              {/* Length */}
              <label style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>LENGTH (s)</span>
                <input type="number" min={0.1}
                  max={Math.min(MAX_ITEM_SECS, Math.max(0.1, TOTAL_SECS-selItem.begin))}
                  step={0.1} value={selItem.length}
                  onChange={e => mutItem(selected.trackId, selected.itemId,
                    { length:clampItemLength(parseFloat(e.target.value||"0.1"), selItem.begin) })}
                  style={field} />
              </label>

              <div style={{ fontSize:10, color:"#2e2e52" }}>
                END: {(selItem.begin+selItem.length).toFixed(3)}s · max {MAX_ITEM_SECS}s
              </div>

              <div style={{ height:1, background:"#141428" }} />

              {/* Prompt */}
              <label style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>PROMPT</span>
                <textarea value={selItem.prompt}
                  onChange={e => mutItem(selected.trackId, selected.itemId, { prompt:e.target.value })}
                  placeholder="Describe the audio to generate…"
                  rows={5} style={{ ...field, resize:"vertical", lineHeight:1.6 }} />
              </label>

              {/* Negative prompt */}
              <label style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>NEGATIVE PROMPT</span>
                <textarea value={selItem.negPrompt||""}
                  onChange={e => mutItem(selected.trackId, selected.itemId, { negPrompt:e.target.value })}
                  placeholder="What to avoid…"
                  rows={2} style={{ ...field, resize:"vertical", lineHeight:1.6 }} />
              </label>

              {/* Inference steps */}
              <label style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <span style={{ fontSize:9.5, color:"#383860", letterSpacing:1.5 }}>INFERENCE STEPS</span>
                  <span style={{ fontSize:12, color:selTrack.color, fontWeight:500 }}>
                    {selItem.numSteps ?? DEFAULT_STEPS}
                  </span>
                </div>
                <input type="range" min={50} max={500} step={50}
                  value={selItem.numSteps ?? DEFAULT_STEPS}
                  onChange={e => mutItem(selected.trackId, selected.itemId, { numSteps:+e.target.value })}
                  style={{ width:"100%", accentColor:selTrack.color }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#222244" }}>
                  <span>50 fast</span><span>300 default</span><span>500 quality</span>
                </div>
              </label>

              <div style={{ height:1, background:"#141428" }} />

              {/* Status */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <StatusDot status={selItem.status} size={7} />
                <span style={{ fontSize:10, color:STATUS_COLOR[selItem.status]??"#333355", flex:1 }}>
                  {selItem.status==="idle"       ? "not generated" :
                   selItem.status==="queued"     ? "queued…" :
                   selItem.status==="generating" ? "generating…" :
                   selItem.status==="done"       ? "ready ✓" :
                   selItem.status==="error"      ? `error: ${selItem.error}` : selItem.status}
                </span>
                {!serverOnline && <span style={{ fontSize:9, color:"#442222" }}>offline</span>}
              </div>

              {/* Generate */}
              {(() => {
                const canGen = serverOnline && selItem.prompt.trim() &&
                  selItem.length <= MAX_ITEM_SECS &&
                  selItem.status !== "queued" && selItem.status !== "generating";
                const label =
                  selItem.status==="generating" ? "⟳ GENERATING…" :
                  selItem.status==="queued"     ? "· QUEUED" :
                  selItem.status==="done"       ? "↺ REGENERATE" : "▶ GENERATE";
                return (
                  <button onClick={() => generateItem(selected.trackId, selected.itemId)}
                    disabled={!canGen}
                    style={mkBtn({ color:canGen?"#22d3ee":"#2a2a44",
                      borderColor:canGen?"#0a2e3a":"#1a1a28", background:"#080816",
                      width:"100%", textAlign:"center", padding:"9px", letterSpacing:1,
                      cursor:canGen?"pointer":"not-allowed", opacity:canGen?1:0.5 })}
                    onMouseEnter={e => { if (canGen) e.currentTarget.style.borderColor="#22d3ee"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=canGen?"#0a2e3a":"#1a1a28"; }}
                  >{label}</button>
                );
              })()}

              {selItem.status === "done" && (
                <button onClick={() => loadInPlayer(selected.trackId, selected.itemId)}
                  style={mkBtn({ color:selTrack.color, borderColor:selTrack.color+"44",
                    background:selTrack.color+"10", width:"100%",
                    textAlign:"center", padding:"9px", letterSpacing:1 })}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=selTrack.color; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=selTrack.color+"44"; }}
                >▶ PLAY CLIP</button>
              )}

              <div style={{ height:1, background:"#141428" }} />

              <button onClick={() => delItem(selected.trackId, selected.itemId)}
                style={mkBtn({ color:"#bb3344", borderColor:"#28101a", background:"#110810",
                  width:"100%", textAlign:"center", padding:"9px", letterSpacing:1 })}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#883344"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#28101a"; }}
              >DELETE ITEM</button>

              {selItem.status === "done" && (
                <button
                  onClick={() => downloadItem(selected.trackId, selected.itemId)}
                  style={mkBtn({ color:"#60a5fa", borderColor:"#0c1e36", background:"#07111e",
                    width:"100%", textAlign:"center", padding:"9px", letterSpacing:1 })}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#60a5fa"; e.currentTarget.style.color="#93c5fd"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#0c1e36"; e.currentTarget.style.color="#60a5fa"; }}
                >⬇ DOWNLOAD WAV</button>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────── */}
      <div style={{ height:76, background:"#07071a", borderTop:"1px solid #121228",
        flexShrink:0, display:"flex", alignItems:"stretch" }}>

        {/* Clip player */}
        <div style={{ flex:"0 0 44%", display:"flex", alignItems:"center", padding:"0 12px", gap:9 }}>
          <div style={{ minWidth:104, maxWidth:104 }}>
            {playerTrack ? (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                  <div style={{ width:6, height:6, borderRadius:1, flexShrink:0,
                    background:playerTrack.color, boxShadow:`0 0 4px ${playerTrack.color}` }} />
                  <span style={{ fontSize:10, color:playerTrack.color,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {playerTrack.name}
                  </span>
                </div>
                <div style={{ fontSize:8.5, color:"#282848",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {playerItem?.name || playerItem?.prompt || player.itemId}
                </div>
              </>
            ) : (
              <span style={{ fontSize:9.5, color:"#141428", fontStyle:"italic" }}>clip player</span>
            )}
          </div>
          <button onClick={() => seekTo(0)} disabled={!player.itemId}
            style={mkBtn({ fontSize:13, padding:"2px 6px",
              color:player.itemId?"#3a3a70":"#141428", borderColor:"#0e0e20", background:"transparent" })}
            onMouseEnter={e => { if (player.itemId) e.currentTarget.style.color="#8888cc"; }}
            onMouseLeave={e => { e.currentTarget.style.color=player.itemId?"#3a3a70":"#141428"; }}>⏮</button>
          <button onClick={togglePlay} disabled={!player.itemId}
            style={{ ...mkBtn({
              width:34, height:34, padding:0, borderRadius:"50%", fontSize:12, textAlign:"center",
              color:       player.itemId ? (playerTrack?.color??"#6868b8")      : "#181830",
              borderColor: player.itemId ? (playerTrack?.color+"50"??"#232340") : "#0e0e20",
              background:  player.itemId ? (playerTrack?.color+"14"??"#0d0d1e") : "#09091a",
            }) }}
            onMouseEnter={e => { if (player.itemId) e.currentTarget.style.background=(playerTrack?.color+"28")??"#1a1a2e"; }}
            onMouseLeave={e => { e.currentTarget.style.background=player.itemId?(playerTrack?.color+"14"??"#0d0d1e"):"#09091a"; }}
          >{player.playing ? "⏸" : "▶"}</button>
          <Scrubber thin current={player.currentTime} total={player.duration}
            color={playerTrack?.color??"#3a3a6a"} onSeek={seekTo} />
          <div style={{ fontSize:10, color:"#2c2c4c", minWidth:66, textAlign:"right",
            fontVariantNumeric:"tabular-nums" }}>
            <span style={{ color:player.playing?(playerTrack?.color??"#6868b8"):"#3a3a60" }}>
              {fmtTime(player.currentTime)}
            </span>
            {" / "}{fmtTime(player.duration)}
          </div>
        </div>

        <div style={{ width:1, background:"#0e0e24", flexShrink:0, margin:"14px 0" }} />

        {/* Mix player */}
        <div style={{ flex:1, display:"flex", alignItems:"center", padding:"0 12px", gap:9 }}>
          <div style={{ minWidth:80, flexShrink:0 }}>
            <div style={{ fontSize:8.5, color:"#1e1e3a", letterSpacing:1.5, marginBottom:3 }}>MIX PLAYER</div>
            <div style={{ fontSize:9, color:doneCount>0?"#34d39980":"#141428" }}>
              {doneCount} clip{doneCount!==1?"s":""} ready
            </div>
          </div>
          <button onClick={toggleMix} disabled={mixState.loading || doneCount===0}
            style={{ ...mkBtn({
              width:34, height:34, padding:0, borderRadius:"50%",
              fontSize:mixState.loading?10:13, textAlign:"center",
              color:       doneCount>0?"#34d399":"#181830",
              borderColor: doneCount>0?"#0d3020":"#0e0e20",
              background:  doneCount>0?"#0a1e14":"#09091a",
              cursor:      doneCount>0?"pointer":"not-allowed",
            }) }}
            onMouseEnter={e => { if (doneCount>0) e.currentTarget.style.background="#0d2a1e"; }}
            onMouseLeave={e => { e.currentTarget.style.background=doneCount>0?"#0a1e14":"#09091a"; }}
          >{mixState.loading ? <span className="anim-spin" style={{ fontSize:11 }}>⟳</span>
            : mixState.playing ? "⏸" : "▶"}</button>
          <button onClick={reloadMix} title="Re-fetch all audio on next play"
            style={mkBtn({ padding:"3px 7px", fontSize:11, color:"#222240", borderColor:"#0e0e1c" })}
            onMouseEnter={e => { e.currentTarget.style.color="#6666aa"; e.currentTarget.style.borderColor="#3a3a5a"; }}
            onMouseLeave={e => { e.currentTarget.style.color="#222240"; e.currentTarget.style.borderColor="#0e0e1c"; }}
          >↺</button>
          <Scrubber thin current={mixState.currentTime} total={mixState.duration}
            color="#34d399" onSeek={seekMix} />
          <div style={{ fontSize:10, color:"#2c2c4c", minWidth:66, textAlign:"right",
            fontVariantNumeric:"tabular-nums" }}>
            <span style={{ color:mixState.playing?"#34d399":"#1a3a28" }}>
              {fmtTime(mixState.currentTime)}
            </span>
            {" / "}{fmtTime(mixState.duration||0)}
          </div>
          <div style={{ width:1, background:"#0e0e24", flexShrink:0, height:28 }} />
          <button onClick={renderMix} disabled={renderingMix || doneCount===0}
            style={mkBtn({
              color:       doneCount>0?"#a78bfa":"#2a2a44",
              borderColor: doneCount>0?"#2a1a4a":"#1a1a28",
              background:  "#090812",
              whiteSpace:"nowrap", padding:"7px 10px", letterSpacing:1,
              cursor:      doneCount>0?"pointer":"not-allowed",
              opacity:     doneCount>0?1:0.4,
            })}
            onMouseEnter={e => { if (doneCount>0) e.currentTarget.style.borderColor="#a78bfa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=doneCount>0?"#2a1a4a":"#1a1a28"; }}
          >{renderingMix ? <span className="anim-spin">⟳</span> : "⬇"} RENDER WAV</button>
        </div>
      </div>

      {/* ── STATUS BAR ───────────────────────────────────────────────────── */}
      <div style={{ height:21, background:"#050510", borderTop:"1px solid #0c0c1c",
        display:"flex", alignItems:"center", padding:"0 14px", gap:14,
        fontSize:9, color:"#1c1c38", letterSpacing:".5px", flexShrink:0, userSelect:"none" }}>
        <span>DRAG → CREATE</span><span>·</span>
        <span>DRAG ITEM → MOVE</span><span>·</span>
        <span>CLICK → INSPECT</span><span>·</span>
        <span>DEL → DELETE</span><span>·</span>
        <span>SPACE → PLAY/PAUSE</span>
        <div style={{ flex:1 }} />
        <span>M/S → instant mute/solo · {TOTAL_SECS}s TIMELINE</span>
      </div>
    </div>
  );
}