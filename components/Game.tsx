import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage } from "@google/genai";
import { GameState, GameMode, ScoreEntry, NaParticle, Rarity, NaVariant, Ending, RunStats } from '../types';
import {
  MODE_DURATIONS, BEAT_INTERVAL_MS, COUNTDOWN_SECONDS, CLEAR_THRESHOLDS,
  FEVER_COMBO, COMBO_BREAK_BEATS, GOLD_BONUS, DIAMOND_BONUS, HIT_WORDS, LS_KEYS,
} from '../constants';
import { encode } from '../utils/audioUtils';
import { rollRarity, pickVariant, createParticles, nextId, VARIANT_LABELS } from '../utils/naEffects';
import { ACHIEVEMENTS, achievementById, evaluate, loadUnlocked, saveUnlocked, loadLifetime, saveLifetime, LifetimeStats } from '../utils/achievements';
import { ENDINGS, TOTAL_ENDINGS, pickEnding, loadSeenEndings, saveSeenEndings } from '../utils/endings';
import NaEffects from './NaEffects';
import Shiashia3D from './Shiashia3D';
import CutIn, { CutInData, CutInKind, CUTIN_LINES } from './CutIn';
import AchievementToasts, { ToastItem } from './AchievementToast';
import EndingScene from './EndingScene';
import CollectionBook from './CollectionBook';

const HIT_WINDOW_MS = 100; // Tightened window, but we check 8th notes now

// SVG Component for the Crowd
const Crowd: React.FC<{ progress: number; fever: boolean }> = ({ progress, fever }) => {
  // progress 0 to 1
  const showLevel1 = progress > 0.3;
  const showLevel2 = progress > 0.6;
  const showLevel3 = progress >= 1.0;
  const c1 = fever ? 'bg-pink-200' : 'bg-gray-200';
  const c2 = fever ? 'bg-pink-300' : 'bg-gray-300';
  const c3 = fever ? 'bg-pink-400' : 'bg-gray-400';

  return (
    <div className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none z-0 overflow-hidden">
      {/* Level 1: Back Row */}
      <div className={`absolute bottom-[-50px] left-0 w-full h-full flex justify-around items-end transition-transform duration-700 ${showLevel1 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
         {Array.from({ length: 8 }).map((_, i) => (
             <div key={`l1-${i}`} className={`w-24 h-32 ${c1} rounded-t-full mx-1 animate-[crowd-jump_0.6s_infinite] origin-bottom`} style={{ animationDelay: `${i * 0.1}s` }}></div>
         ))}
      </div>

      {/* Level 2: Mid Row */}
      <div className={`absolute bottom-[-30px] left-[-5%] w-[110%] h-full flex justify-around items-end transition-transform duration-700 delay-100 ${showLevel2 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
         {Array.from({ length: 7 }).map((_, i) => (
             <div key={`l2-${i}`} className={`w-32 h-40 ${c2} rounded-t-full mx-1 animate-[crowd-jump_0.5s_infinite] origin-bottom`} style={{ animationDelay: `${i * 0.15}s` }}></div>
         ))}
      </div>

      {/* Level 3: Front Row */}
      <div className={`absolute bottom-[-10px] left-[-10%] w-[120%] h-full flex justify-around items-end transition-transform duration-700 delay-200 ${showLevel3 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
         {Array.from({ length: 6 }).map((_, i) => (
             <div key={`l3-${i}`} className={`w-40 h-48 ${c3} rounded-t-full mx-1 animate-[crowd-jump_0.4s_infinite] origin-bottom relative`} style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Hands */}
                <div className={`absolute -top-10 -left-4 w-12 h-24 ${c3} rounded-full rotate-[-20deg]`}></div>
                <div className={`absolute -top-10 -right-4 w-12 h-24 ${c3} rounded-full rotate-[20deg]`}></div>
             </div>
         ))}
      </div>
    </div>
  );
};

interface HitWord { id: number; text: string; left: string; top: string; color: string; }
interface ScorePop { id: number; text: string; left: string; }

const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('READY');
  const [gameMode, setGameMode] = useState<GameMode>('30s');
  const [score, setScore] = useState(0); // This is "Hits" now
  const [subscribers, setSubscribers] = useState(0); // This is the new "Score"
  const [timeLeft, setTimeLeft] = useState(MODE_DURATIONS['30s']);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [particles, setParticles] = useState<NaParticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);

  // Animation State
  const [isHitAnimating, setIsHitAnimating] = useState(false);

  // --- 演出 State ---
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [fever, setFever] = useState(false);
  const [hitWords, setHitWords] = useState<HitWord[]>([]);
  const [scorePops, setScorePops] = useState<ScorePop[]>([]);
  const [cutIn, setCutIn] = useState<CutInData | null>(null);
  const [shakeClass, setShakeClass] = useState('');
  const [worldInvert, setWorldInvert] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [endingIsNew, setEndingIsNew] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [clearShown, setClearShown] = useState(false);
  const [lastRareLabel, setLastRareLabel] = useState<string | null>(null);

  // --- 永続データ ---
  const [unlocked, setUnlocked] = useState<Record<string, number>>({});
  const [seenEndings, setSeenEndings] = useState<Record<string, number>>({});
  const [seenVariants, setSeenVariants] = useState<Record<string, number>>({});
  const unlockedRef = useRef<Record<string, number>>({});
  const seenEndingsRef = useRef<Record<string, number>>({});
  const seenVariantsRef = useRef<Record<string, number>>({});
  const lifeRef = useRef<LifetimeStats>(loadLifetime());

  // --- 1プレイの統計 ---
  const runRef = useRef<RunStats & { finished?: boolean }>({
    mode: '30s', hits: 0, subscribers: 0, maxCombo: 0, goldClicks: 0, diamondClicks: 0, rareSeen: 0, ultraSeen: 0,
    feverCount: 0, pauses: 0, cutIns: 0, shiashiaPokes: 0, cleared: false, perfect: false,
  });
  const comboRef = useRef(0);
  const feverRef = useRef(false);
  const lastHitTimeRef = useRef(0);     // コンボ切れ判定用
  const hitRef = useRef(0);             // しあしあ3D の口パク用
  const cutInTimerRef = useRef<number | null>(null);
  const gameModeRef = useRef<GameMode>('30s');
  const scoreRef = useRef(0);
  const subsRef = useRef(0);
  const timeLeftRef = useRef(MODE_DURATIONS['30s']);
  const finishingRef = useRef(false);
  const endingDoneRef = useRef(false);
  const rareLabelTimerRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [inputMode, setInputMode] = useState<'mic' | 'tap'>(process.env.TAP_ONLY ? 'tap' : 'mic');
  const inputModeRef = useRef<'mic' | 'tap'>(process.env.TAP_ONLY ? 'tap' : 'mic');
  const lastTapRef = useRef(0);
  const tapLoopRef = useRef<number | null>(null);
  inputModeRef.current = inputMode;
  gameModeRef.current = gameMode;

  // Asset URLs - using GitHub Raw URLs for reliable hosting
  const assetBase = (process.env.ASSET_BASE as string) || 'https://raw.githubusercontent.com/mshinyukari/-/main/';
  const defaultBgmUrl = assetBase + 'bgm/bgm.mp3';
  const menuBgmUrl = assetBase + 'bgm/top.mp3';
  const TAP_ONLY = !!process.env.TAP_ONLY; // ビルド時フラグ：マイクを使わない配布版

  // Settings State
  const [volume, setVolume] = useState(0.5);
  const [bgmSource, setBgmSource] = useState<string>(defaultBgmUrl);
  const [customUrl, setCustomUrl] = useState(''); // State for manual URL input
  const [micThreshold, setMicThreshold] = useState(30); // 0-100 visual scale
  const [inputLevel, setInputLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);

  // Device Selection State
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const sessionPromise = useRef<Promise<any> | null>(null);
  const lastTranscription = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const metronomeInterval = useRef<number | null>(null);
  const gameTimer = useRef<number | null>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const menuBgmRef = useRef<HTMLAudioElement>(null);

  // Refs for Mic Test & Game Audio Analysis
  const streamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micCheckInterval = useRef<number | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isGameActiveRef = useRef(false); // Strict control for scoring loop

  // Logic Refs
  const lastAudioVolume = useRef(0);
  const isArmedRef = useRef(true); // For "Valley" detection
  const currentNotePeakRef = useRef(0); // Track peak of current sound to determine drop-off

  // Rhythm Refs
  const lastBeatTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0); // To calculate elapsed time for inflation
  const pauseStartTimeRef = useRef<number>(0); // To adjust startTimeRef after pause

  // ===================== 永続データの読み込み =====================
  useEffect(() => {
    const u = loadUnlocked(); unlockedRef.current = u; setUnlocked(u);
    const e = loadSeenEndings(); seenEndingsRef.current = e; setSeenEndings(e);
    try {
      const v = JSON.parse(localStorage.getItem(LS_KEYS.variants) || '{}');
      seenVariantsRef.current = v; setSeenVariants(v);
    } catch { /* noop */ }
    loadScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const bumpLife = (patch: Partial<LifetimeStats> | ((l: LifetimeStats) => Partial<LifetimeStats>)) => {
    const p = typeof patch === 'function' ? patch(lifeRef.current) : patch;
    lifeRef.current = { ...lifeRef.current, ...p };
    saveLifetime(lifeRef.current);
  };

  // ===================== 実績 =====================
  const checkAchievements = useCallback((finished = false) => {
    const run = { ...runRef.current, hits: scoreRef.current, subscribers: subsRef.current, maxCombo: Math.max(runRef.current.maxCombo, comboRef.current), finished };
    const seenCount = Object.keys(seenEndingsRef.current).length;
    const secretSeen = ENDINGS.some((e) => e.condition === 'secret' && seenEndingsRef.current[e.id]);
    const newly = evaluate(run, lifeRef.current, { seen: seenCount, total: TOTAL_ENDINGS, secretSeen }, unlockedRef.current);
    if (newly.length === 0) return;
    const now = Date.now();
    newly.forEach((id) => { unlockedRef.current[id] = now; });
    unlockedRef.current = { ...unlockedRef.current };
    saveUnlocked(unlockedRef.current);
    setUnlocked(unlockedRef.current);
    const items: ToastItem[] = newly.map((id, i) => ({ id: now + i, achievement: achievementById(id)! }));
    setToasts((prev) => [...prev, ...items]);
    items.forEach((it) => setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== it.id)), 4200));
  }, []);

  // ===================== カットイン =====================
  const showCutIn = useCallback((kind: CutInKind, force = false, durationMs = 2000) => {
    if (cutInTimerRef.current && !force) return; // 表示中は重ねない
    const candidates = CUTIN_LINES[kind];
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const moodByKind = { combo: 'dance', fever: 'celebrate', rare: 'shock', ultra: 'spin', gold: 'celebrate', clear: 'celebrate', random: 'idle', poke: 'shock' } as const;
    if (cutInTimerRef.current) clearTimeout(cutInTimerRef.current);
    setCutIn({ id: nextId(), kind, text: pick.text, sub: pick.sub, durationMs, mood: moodByKind[kind] });
    runRef.current.cutIns++;
    bumpLife((l) => ({ cutIns: l.cutIns + 1 }));
    cutInTimerRef.current = window.setTimeout(() => {
      setCutIn(null);
      cutInTimerRef.current = null;
    }, durationMs);
    setTimeout(() => checkAchievements(), 50);
  }, [checkAchievements]);

  const doShake = (cls: string, ms: number) => {
    setShakeClass(cls);
    setTimeout(() => setShakeClass(''), ms);
  };

  const addHitWord = (text: string, color = 'text-pink-500', near = true) => {
    const id = nextId();
    const left = near ? `${40 + Math.random() * 20}%` : `${10 + Math.random() * 80}%`;
    const top = near ? `${35 + Math.random() * 20}%` : `${15 + Math.random() * 60}%`;
    setHitWords((prev) => [...prev.slice(-12), { id, text, left, top, color }]);
    setTimeout(() => setHitWords((prev) => prev.filter((w) => w.id !== id)), 900);
  };

  const addScorePop = (text: string) => {
    const id = nextId();
    setScorePops((prev) => [...prev.slice(-8), { id, text, left: `${45 + Math.random() * 10}%` }]);
    setTimeout(() => setScorePops((prev) => prev.filter((w) => w.id !== id)), 1000);
  };

  const flashRareLabel = (label: string) => {
    setLastRareLabel(label);
    if (rareLabelTimerRef.current) clearTimeout(rareLabelTimerRef.current);
    rareLabelTimerRef.current = window.setTimeout(() => setLastRareLabel(null), 3000);
  };

  const recordVariant = (v: NaVariant) => {
    seenVariantsRef.current = { ...seenVariantsRef.current, [v]: (seenVariantsRef.current[v] || 0) + 1 };
    try { localStorage.setItem(LS_KEYS.variants, JSON.stringify(seenVariantsRef.current)); } catch { /* noop */ }
    setSeenVariants(seenVariantsRef.current);
  };

  /** 「な」を出す（レア度抽選込み） */
  const spawnNa = (forceRarity?: Rarity) => {
    const rarity = forceRarity ?? rollRarity(feverRef.current);
    const variant = pickVariant(rarity);
    const ps = createParticles(variant, rarity);
    setParticles((prev) => [...prev, ...ps].slice(-160));
    recordVariant(variant);

    // --- レア演出 ---
    if (rarity === 'rare') {
      runRef.current.rareSeen++;
      bumpLife((l) => ({ rareSeen: l.rareSeen + 1 }));
      flashRareLabel(`レア：${VARIANT_LABELS[variant]}`);
      if (Math.random() < 0.4) showCutIn('rare');
    }
    if (rarity === 'ultra') {
      runRef.current.ultraSeen++;
      bumpLife((l) => ({ ultraSeen: l.ultraSeen + 1 }));
      flashRareLabel(`ウルトラレア：${VARIANT_LABELS[variant]}`);
      showCutIn('ultra', true, 2200);
    }

    switch (variant) {
      case 'giant': doShake('shake', 500); break;
      case 'thunder':
        setFlash(true); setTimeout(() => setFlash(false), 500);
        doShake('shake', 500);
        break;
      case 'tsunami': doShake('shake-hard', 2400); break;
      case 'chaos': doShake('shake-hard', 3500); break;
      case 'invert': setWorldInvert(true); setTimeout(() => setWorldInvert(false), 2500); break;
      case 'blackhole': doShake('shake', 900); break;
      default: break;
    }
    if (rarity !== 'normal') setTimeout(() => checkAchievements(), 30);
  };

  // ===================== 特殊な「な」クリック =====================
  const handleSpecialClick = (p: NaParticle, e: React.MouseEvent) => {
    e.stopPropagation();
    setParticles((prev) => prev.filter((x) => x.id !== p.id));
    const mult = feverRef.current ? 2 : 1;
    const bonus = (p.variant === 'diamond' ? DIAMOND_BONUS : GOLD_BONUS) * mult;
    subsRef.current += bonus;
    setSubscribers(subsRef.current);
    addScorePop(`+${bonus.toLocaleString()}`);
    addHitWord(p.variant === 'diamond' ? '💎ダイヤ！' : '⭐ゲット！', 'text-amber-500', false);
    if (p.variant === 'diamond') {
      runRef.current.diamondClicks++;
      bumpLife((l) => ({ totalDiamond: l.totalDiamond + 1 }));
      showCutIn('gold', true);
      doShake('shake', 600);
      // ダイヤはおまけで大群も出す
      spawnNa('uncommon');
    } else {
      runRef.current.goldClicks++;
      bumpLife((l) => ({ totalGold: l.totalGold + 1 }));
      if (Math.random() < 0.5) showCutIn('gold');
    }
    checkAchievements();
  };

  // ===================== しあしあをつつく =====================
  const handlePoke = () => {
    runRef.current.shiashiaPokes++;
    bumpLife((l) => ({ totalPokes: l.totalPokes + 1 }));
    addHitWord(['つんっ', 'ひゃっ', 'やめて', 'な！', 'くすぐったい'][Math.floor(Math.random() * 5)], 'text-emerald-500', false);
    if (gameState === 'PLAYING' && Math.random() < 0.25) showCutIn('poke');
    if (gameState === 'READY' && lifeRef.current.totalPokes % 5 === 0) showCutIn('poke', true, 1800);
    checkAchievements();
  };

  // Sync BGM Volume
  useEffect(() => {
      if (gameState !== 'COUNTDOWN') {
          if (bgmRef.current) {
              bgmRef.current.volume = volume;
          }
      }
      if (menuBgmRef.current) {
          menuBgmRef.current.volume = volume;
      }
  }, [volume, gameState]);

  // Handle BGM File Selection
  const handleBgmSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          setBgmSource(url);
          setCustomUrl('');
          if (bgmSource.startsWith('blob:')) {
              URL.revokeObjectURL(bgmSource);
          }
          bumpLife({ bgmChanged: true });
          checkAchievements();
      }
  };

  // Handle URL Input
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const url = e.target.value;
      setCustomUrl(url);
      if (url) {
          setBgmSource(url);
          bumpLife({ bgmChanged: true });
          checkAchievements();
      } else {
          setBgmSource(defaultBgmUrl);
      }
  };

  // --- Device Management ---
  const fetchAudioDevices = useCallback(async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length > 0) {
             const exists = inputs.find(d => d.deviceId === selectedDeviceId);
             if (!selectedDeviceId || !exists) {
                 setSelectedDeviceId(inputs[0].deviceId);
             }
        }
    } catch (e) {
        console.warn("Could not enumerate devices");
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchAudioDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchAudioDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', fetchAudioDevices);
  }, [fetchAudioDevices]);

  const getAudioStream = async () => {
      if (streamRef.current) {
          const tracks = streamRef.current.getAudioTracks();
          if (tracks.length > 0 && tracks[0].readyState === 'live') {
              const settings = tracks[0].getSettings();
              if (!selectedDeviceId || settings.deviceId === selectedDeviceId) {
                  return streamRef.current;
              }
          }
      }
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
      }
      const constraints = {
          audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      return stream;
  };

  // --- Score Saving ---
  const saveScore = (finalSubscribers: number, finalHitCount: number, endingId?: string) => {
    const key = `rhythm_na_subs_${gameModeRef.current}`;
    const existing = localStorage.getItem(key);
    let scores: ScoreEntry[] = existing ? JSON.parse(existing) : [];
    const safeSubs = typeof finalSubscribers === 'number' ? finalSubscribers : 0;
    const safeHits = typeof finalHitCount === 'number' ? finalHitCount : 0;
    scores.push({ score: safeSubs, hitCount: safeHits, date: Date.now(), endingId });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5);
    try {
        localStorage.setItem(key, JSON.stringify(scores));
    } catch (e) {
        console.error("Failed to save score");
    }
    setHighScores(scores);
  };

  const loadScores = () => {
    const key = `rhythm_na_subs_${gameModeRef.current}`;
    const existing = localStorage.getItem(key);
    if (existing) {
        try {
            setHighScores(JSON.parse(existing));
        } catch (e) {
            setHighScores([]);
        }
    } else {
        setHighScores([]);
    }
  };

  // --- Audio Cleanup ---
  const cleanupAudio = useCallback(() => {
    if (metronomeInterval.current) {
      clearInterval(metronomeInterval.current);
      metronomeInterval.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopMicAnalysis = useCallback((keepStream = false) => {
    if (micCheckInterval.current) {
        clearInterval(micCheckInterval.current);
        micCheckInterval.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
        micAudioCtxRef.current.close();
        micAudioCtxRef.current = null;
    }
    if (!keepStream && streamRef.current) {
         streamRef.current.getTracks().forEach(t => t.stop());
         streamRef.current = null;
    }
    setInputLevel(0);
    setIsMicTesting(false);
  }, []);

  // --- Audio Volume Helper ---
  const calculateVolume = (analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>) => {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    const binsToCheck = dataArray.length / 2;
    for(let i = 0; i < binsToCheck; i++) {
        sum += dataArray[i];
    }
    const average = sum / binsToCheck;
    return Math.min(100, (average / 128) * 100 * 2.0);
  };

  // --- Mic Test Logic ---
  const toggleMicTest = async () => {
    if (isMicTesting) {
        stopMicAnalysis();
        return;
    }
    try {
        const stream = await getAudioStream();
        fetchAudioDevices();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        micAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        micAnalyserRef.current = analyser;
        const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        micCheckInterval.current = window.setInterval(() => {
            const normalized = calculateVolume(analyser, dataArray);
            setInputLevel(normalized);
        }, 50);
        setIsMicTesting(true);
        setError(null);
        bumpLife({ micTested: true });
        checkAchievements();
    } catch (err) {
        console.error("Mic access denied");
        setError("マイクにアクセスできませんでした。");
    }
  };

  // ===================== ヒット！ =====================
  const triggerHit = () => {
    if (!isGameActiveRef.current) return; // Strict check
    const now = Date.now();

    // Trigger Reactive Animation
    setIsHitAnimating(true);
    setTimeout(() => setIsHitAnimating(false), 100);
    hitRef.current = now;
    lastHitTimeRef.current = now;

    // Increment Hits
    scoreRef.current += 1;
    setScore(scoreRef.current);

    // --- コンボ ---
    comboRef.current += 1;
    const c = comboRef.current;
    setCombo(c);
    if (c > runRef.current.maxCombo) { runRef.current.maxCombo = c; setMaxCombo(c); }
    if (c === 10 || c === 30 || c === 50 || c === 100 || (c > 100 && c % 50 === 0)) {
      showCutIn('combo');
      spawnNa('uncommon');
    }

    // --- フィーバー ---
    if (!feverRef.current && c >= FEVER_COMBO) {
      feverRef.current = true;
      setFever(true);
      runRef.current.feverCount++;
      showCutIn('fever', true, 2200);
      spawnNa('rare');
    }

    // Calculate Subscriber Gain based on Inflation Logic
    const elapsedTime = (now - startTimeRef.current) / 1000;
    let gain = 100;
    if (elapsedTime > 85) gain = 1000000;
    else if (elapsedTime > 60) gain = 500000;
    else if (elapsedTime > 30) gain = 50000;
    else if (elapsedTime > 10) gain = 500;
    else gain = 100;
    if (feverRef.current) gain *= 2;
    // コンボボーナス（10コンボごとに+10%）
    gain = Math.round(gain * (1 + Math.floor(c / 10) * 0.1));

    subsRef.current += gain;
    setSubscribers(subsRef.current);

    // --- 演出 ---
    spawnNa();
    if (feverRef.current && Math.random() < 0.5) spawnNa();
    if (c % 5 === 0 || Math.random() < 0.3) {
      addHitWord(HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)]);
    }
    if (c % 10 === 0) addScorePop(`+${gain.toLocaleString()}`);

    // たまに意味もなくカットイン
    if (Math.random() < 0.012) showCutIn('random', false, 1800);

    // クリア
    if (!runRef.current.cleared && scoreRef.current >= CLEAR_THRESHOLDS[gameModeRef.current]) {
      runRef.current.cleared = true;
      setClearShown(true);
      showCutIn('clear', true, 2400);
      spawnNa('ultra');
      doShake('shake', 600);
    }

    if (c % 10 === 0 || c === 1) checkAchievements();
  };

  const breakCombo = () => {
    if (comboRef.current === 0) return;
    comboRef.current = 0;
    setCombo(0);
    if (feverRef.current) {
      feverRef.current = false;
      setFever(false);
      addHitWord('フィーバー終了…', 'text-slate-400', false);
    }
  };

  /** タップ / キー入力での「な」（マイクが使えない環境向け） */
  const handleTap = () => {
    if (!isGameActiveRef.current) return;
    const now = Date.now();
    if (now - lastTapRef.current < 60) return; // 連打のダブル判定防止
    lastTapRef.current = now;
    const timeSinceLastBeat = now - lastBeatTimeRef.current;
    const phase = (timeSinceLastBeat % BEAT_INTERVAL_MS) / BEAT_INTERVAL_MS;
    const distToQuarter = Math.min(phase, 1.0 - phase) * BEAT_INTERVAL_MS;
    const distToEighth = Math.abs(phase - 0.5) * BEAT_INTERVAL_MS;
    if (distToQuarter < HIT_WINDOW_MS * 1.3 || distToEighth < HIT_WINDOW_MS * 1.3) {
      triggerHit();
    } else {
      addHitWord(phase < 0.25 || (phase > 0.5 && phase < 0.75) ? 'おそい' : 'はやい', 'text-slate-400');
    }
  };
  const handleTapRef = useRef(handleTap);
  handleTapRef.current = handleTap;

  const startTapLoop = () => {
    if (tapLoopRef.current) cancelAnimationFrame(tapLoopRef.current);
    const loop = () => {
      if (!isGameActiveRef.current) return;
      if (comboRef.current > 0 && Date.now() - lastHitTimeRef.current > BEAT_INTERVAL_MS * COMBO_BREAK_BEATS) {
        breakCombo();
      }
      tapLoopRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key.toLowerCase() === 'n') {
        if (inputModeRef.current === 'tap') { e.preventDefault(); handleTapRef.current(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startGameAudioAnalysis = async () => {
    try {
        const stream = await getAudioStream();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        micAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);
        const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

        isArmedRef.current = true;
        currentNotePeakRef.current = 0;
        lastAudioVolume.current = 0;
        if (startTimeRef.current === 0) startTimeRef.current = Date.now();

        const loop = () => {
            if (!isGameActiveRef.current) return;

            const vol = calculateVolume(analyser, dataArray);
            const SENSITIVITY = 15;
            const isSharpRise = (vol - lastAudioVolume.current) > SENSITIVITY;

            // コンボ切れ判定
            if (comboRef.current > 0 && Date.now() - lastHitTimeRef.current > BEAT_INTERVAL_MS * COMBO_BREAK_BEATS) {
                breakCombo();
            }

            if (vol > micThreshold) {
                if (isArmedRef.current && isSharpRise) {
                    const now = Date.now();
                    const timeSinceLastBeat = now - lastBeatTimeRef.current;
                    const phase = (timeSinceLastBeat % BEAT_INTERVAL_MS) / BEAT_INTERVAL_MS;
                    const distToQuarter = Math.min(phase, 1.0 - phase) * BEAT_INTERVAL_MS;
                    const distToEighth = Math.abs(phase - 0.5) * BEAT_INTERVAL_MS;
                    if (distToQuarter < HIT_WINDOW_MS || distToEighth < HIT_WINDOW_MS) {
                        triggerHit();
                        isArmedRef.current = false;
                        currentNotePeakRef.current = vol;
                    }
                }
                if (!isArmedRef.current) {
                    if (vol > currentNotePeakRef.current) {
                        currentNotePeakRef.current = vol;
                    }
                    if (vol < currentNotePeakRef.current * 0.7) {
                        isArmedRef.current = true;
                        currentNotePeakRef.current = 0;
                    }
                }
            } else {
                isArmedRef.current = true;
                currentNotePeakRef.current = 0;
            }

            lastAudioVolume.current = vol;
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        loop();
    } catch (err) {
        console.error("Game Audio Init Error");
        setError("マイクの開始に失敗しました。せっていで「タップ」入力にすると遊べます。");
    }
  };

  // --- Game State Management ---
  const resetGame = useCallback(() => {
    setScore(0);
    setSubscribers(0);
    scoreRef.current = 0;
    subsRef.current = 0;
    setTimeLeft(MODE_DURATIONS[gameMode]);
    timeLeftRef.current = MODE_DURATIONS[gameMode];
    setCountdown(COUNTDOWN_SECONDS);
    setParticles([]);
    setHitWords([]);
    setScorePops([]);
    setCombo(0); setMaxCombo(0); setFever(false);
    comboRef.current = 0; feverRef.current = false;
    setClearShown(false);
    setLastRareLabel(null);
    setEnding(null);
    setCutIn(null);
    if (cutInTimerRef.current) { clearTimeout(cutInTimerRef.current); cutInTimerRef.current = null; }
    finishingRef.current = false;
    endingDoneRef.current = false;
    runRef.current = {
      mode: gameMode, hits: 0, subscribers: 0, maxCombo: 0, goldClicks: 0, diamondClicks: 0, rareSeen: 0, ultraSeen: 0,
      feverCount: 0, pauses: 0, cutIns: 0, shiashiaPokes: 0, cleared: false, perfect: false,
    };
    setError(null);
    lastTranscription.current = '';
    isGameActiveRef.current = false;
    lastBeatTimeRef.current = 0;
    startTimeRef.current = 0;
    pauseStartTimeRef.current = 0;
    lastHitTimeRef.current = 0;

    if (gameTimer.current) clearInterval(gameTimer.current);
    cleanupAudio();
    stopMicAnalysis(false);
    if(sessionPromise.current) {
        sessionPromise.current.then(session => session.close());
        sessionPromise.current = null;
    }
    if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
    }
  }, [cleanupAudio, stopMicAnalysis, gameMode]);

  const handleTranscription = useCallback((message: LiveServerMessage) => {
    if (message.serverContent?.turnComplete) {
      lastTranscription.current = '';
    }
  }, []);

  const connectToGemini = useCallback(async () => {
    try {
        const stream = await getAudioStream();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        sessionPromise.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        if (sessionPromise.current) {
                            sessionPromise.current.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        }
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: handleTranscription,
                onerror: (e: ErrorEvent) => {
                    console.error('Gemini API Error');
                },
                onclose: () => {
                    console.log('Gemini session closed.');
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                inputAudioTranscription: {},
                systemInstruction: "You are a referee for a rhythm game. Just listen. Do not speak.",
            },
        });
        await sessionPromise.current;
    } catch (err) {
        console.error("Failed to initialize Gemini session");
        setError("AIサーバーへの接続に失敗しました。ネット環境を確認するか、時間をおいて試してください。");
    }
  }, [handleTranscription]);

  const startAudio = () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    const playBeat = () => {
        if (!audioContextRef.current) return;
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
        const vol = 0.1 * volume;
        gainNode.gain.setValueAtTime(vol, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 0.1);
        oscillator.start(audioContextRef.current.currentTime);
        oscillator.stop(audioContextRef.current.currentTime + 0.1);
        lastBeatTimeRef.current = Date.now();
    };
    playBeat();
    if (metronomeInterval.current) clearInterval(metronomeInterval.current);
    metronomeInterval.current = window.setInterval(playBeat, BEAT_INTERVAL_MS);
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('PLAYING');
      }
    }
  }, [gameState, countdown]);

  // ===================== ゲーム終了 → エンディング =====================
  const finishGame = () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    isGameActiveRef.current = false;
    const mode = gameModeRef.current;
    const hits = scoreRef.current;
    const beats = (MODE_DURATIONS[mode] * 1000) / BEAT_INTERVAL_MS;
    const run: RunStats = {
      ...runRef.current,
      mode,
      hits,
      subscribers: subsRef.current,
      maxCombo: Math.max(runRef.current.maxCombo, comboRef.current),
      cleared: hits >= CLEAR_THRESHOLDS[mode],
      perfect: hits >= beats * 0.9,
    };
    runRef.current = run;
    const e = pickEnding(run, seenEndingsRef.current);
    const isNew = !seenEndingsRef.current[e.id];
    seenEndingsRef.current = { ...seenEndingsRef.current, [e.id]: seenEndingsRef.current[e.id] || Date.now() };
    saveSeenEndings(seenEndingsRef.current);
    setSeenEndings(seenEndingsRef.current);
    setEnding(e);
    setEndingIsNew(isNew);
    setCutIn(null);
    setGameState('ENDING');
  };

  const handleEndingDone = () => {
    if (!ending || endingDoneRef.current) return;
    endingDoneRef.current = true;
    saveScore(subsRef.current, scoreRef.current, ending.id);
    bumpLife((l) => ({ plays: l.plays + 1, totalHits: l.totalHits + scoreRef.current }));
    checkAchievements(true);
    setGameState('FINISHED');
  };

  useEffect(() => {
    // Menu BGM Logic
    if (gameState === 'READY') {
        const playMusic = () => {
            if (menuBgmRef.current && menuBgmRef.current.paused) {
                menuBgmRef.current.play().catch(() => {});
            }
        };
        if (menuBgmRef.current) {
            menuBgmRef.current.play().catch(() => {
                window.addEventListener('click', playMusic, { once: true });
                window.addEventListener('touchstart', playMusic, { once: true });
                window.addEventListener('keydown', playMusic, { once: true });
            });
        }
        return () => {
            window.removeEventListener('click', playMusic);
            window.removeEventListener('touchstart', playMusic);
            window.removeEventListener('keydown', playMusic);
        };
    } else {
        if (menuBgmRef.current) {
            menuBgmRef.current.pause();
            menuBgmRef.current.currentTime = 0;
        }
    }

    if (gameState === 'PLAYING') {
      isGameActiveRef.current = true;
      if (pauseStartTimeRef.current > 0) {
          const pausedDuration = Date.now() - pauseStartTimeRef.current;
          startTimeRef.current += pausedDuration;
          lastHitTimeRef.current += pausedDuration;
          pauseStartTimeRef.current = 0;
      }
      startAudio();
      if (bgmRef.current) {
          bgmRef.current.currentTime = 0;
          bgmRef.current.volume = volume;
          bgmRef.current.play().catch(e => console.warn("BGM play failed", e));
      }
      if (inputModeRef.current === 'tap') startTapLoop(); else startGameAudioAnalysis();
      if (gameTimer.current) clearInterval(gameTimer.current);
      gameTimer.current = window.setInterval(() => {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
        setTimeLeft(timeLeftRef.current);
        if (timeLeftRef.current <= 0) {
          clearInterval(gameTimer.current!);
          gameTimer.current = null;
          isGameActiveRef.current = false;
          finishGame();
        }
      }, 1000);

    } else if (gameState === 'PAUSED') {
       isGameActiveRef.current = false;
       pauseStartTimeRef.current = Date.now();
       runRef.current.pauses++;
       if (bgmRef.current) bgmRef.current.pause();
       if (gameTimer.current) { clearInterval(gameTimer.current); gameTimer.current = null; }
       if (metronomeInterval.current) { clearInterval(metronomeInterval.current); metronomeInterval.current = null; }
       stopMicAnalysis(true);
       setTimeout(() => checkAchievements(), 10);

    } else if (gameState === 'COUNTDOWN') {
        if (bgmRef.current) {
            bgmRef.current.volume = 0;
            if (bgmRef.current.paused) {
                 bgmRef.current.play().catch(e => console.warn("Silent warmup failed", e));
            }
        }
    } else {
      // READY / ENDING / FINISHED
      isGameActiveRef.current = false;
      if (bgmRef.current) {
          bgmRef.current.pause();
          bgmRef.current.currentTime = 0;
      }
      cleanupAudio();
      stopMicAnalysis(false);
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // 「な」の寿命管理
  useEffect(() => {
    const interval = setInterval(() => {
        setParticles(prev => {
            const now = Date.now();
            const filtered = prev.filter(p => now - Math.floor(p.id / 100) < p.life + 1500);
            return filtered.length !== prev.length ? filtered : prev;
        });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
      stopMicAnalysis(false);
      if (gameTimer.current) clearInterval(gameTimer.current);
      if(sessionPromise.current) {
          sessionPromise.current.then(session => session.close());
      }
      if (bgmSource.startsWith('blob:')) {
          URL.revokeObjectURL(bgmSource);
      }
    };
  }, [cleanupAudio, stopMicAnalysis, bgmSource]);

  const handleStart = async () => {
    resetGame();
    if (bgmRef.current) {
        try {
            bgmRef.current.volume = 0;
            bgmRef.current.currentTime = 0;
            await bgmRef.current.play();
        } catch(e) {
            console.warn("BGM Access Error", e);
            setError("BGMの再生に失敗しました。URLを確認してください。");
        }
    }
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }
    if (process.env.API_KEY && inputModeRef.current === 'mic') connectToGemini();
    setGameState('COUNTDOWN');
  };

  const handlePlayAgain = () => {
    resetGame();
    loadScores();
    setGameState('READY');
  };

  const handleQuit = () => {
      resetGame();
      setGameState('READY');
  };

  const handlePause = () => setGameState('PAUSED');
  const handleResume = () => setGameState('PLAYING');

  const handleTitleClick = () => {
    bumpLife((l) => ({ titleClicks: l.titleClicks + 1 }));
    const n = lifeRef.current.titleClicks;
    addHitWord(n >= 10 ? 'もうやめて' : n >= 5 ? 'な？' : 'な', 'text-pink-500', false);
    spawnNa(n >= 10 ? 'rare' : undefined);
    checkAchievements();
  };

  // ===================== 描画 =====================
  const renderContent = () => {
    const threshold = CLEAR_THRESHOLDS[gameMode];
    const isCleared = score >= threshold;

    const HUD = (
        <div className="absolute top-0 w-full flex flex-col p-4 pointer-events-none z-20 pl-20">
            <div className="flex justify-between items-start w-full gap-4">
                <div className="flex-1 max-w-sm">
                     <div className="bg-white/90 backdrop-blur rounded-full p-2 border-4 border-pink-400 shadow-md flex items-center gap-3">
                        <div className="text-pink-500 font-black text-lg px-2">のこり</div>
                        <div className="flex-1 h-6 bg-pink-100 rounded-full overflow-hidden border-2 border-pink-200">
                            <div className="h-full bg-pink-400 transition-all duration-1000 linear" style={{ width: `${(timeLeft / MODE_DURATIONS[gameMode]) * 100}%` }}></div>
                        </div>
                        <div className="text-2xl font-black text-slate-700 w-16 text-right">{timeLeft}</div>
                     </div>
                </div>
                <div className="flex-1 max-w-sm">
                    <div className={`bg-white/90 backdrop-blur rounded-full p-2 border-4 shadow-md flex items-center gap-3 ${isCleared ? 'border-yellow-400 animate-pulse ring-4 ring-yellow-200' : 'border-cyan-400'}`}>
                        <div className={`${isCleared ? 'text-yellow-500' : 'text-cyan-500'} font-black text-lg px-2`}>
                            {isCleared ? 'クリア！' : 'ノルマ'}
                        </div>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden border-2 border-gray-200 relative">
                            <div
                                className={`h-full transition-all duration-200 ease-out ${isCleared ? 'bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 animate-[scroll-bg_1s_linear_infinite] bg-[length:200%_100%]' : 'bg-cyan-400'}`}
                                style={{ width: `${Math.min(100, (score / threshold) * 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-2xl font-black text-slate-700 w-24 text-right">
                            {score}<span className="text-sm text-gray-400">/{threshold}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscribers Score (Center) */}
            <div className="flex justify-center mt-4">
                <div className={`bg-white/90 backdrop-blur-sm rounded-3xl px-8 py-2 border-b-8 shadow-xl text-center transform transition-transform ${fever ? 'border-pink-400 scale-105' : 'border-slate-200'}`}>
                    <div className="text-xs font-bold text-slate-400 tracking-wider mb-1">チャンネル登録者数</div>
                    <div className="text-6xl md:text-7xl font-black text-slate-800 tracking-tighter leading-none flex items-baseline gap-2">
                         {subscribers.toLocaleString()}
                         <span className="text-2xl text-slate-500 font-bold">人</span>
                    </div>
                </div>
            </div>

            {/* コンボ & フィーバー */}
            <div className="flex justify-center mt-2 gap-3 items-center h-12">
                {combo >= 3 && (
                    <div key={combo} className={`font-black text-3xl md:text-4xl animate-impact ${fever ? 'text-orange-500' : 'text-pink-500'} drop-shadow-[3px_3px_0_#fff]`} style={{ WebkitTextStroke: '1px #fff' }}>
                        {combo} <span className="text-base">COMBO</span>
                    </div>
                )}
                {fever && (
                    <div className="fever-text bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 text-white font-black px-5 py-1 rounded-full border-4 border-white shadow-lg text-lg md:text-2xl">
                        🔥 FEVER ×2 🔥
                    </div>
                )}
            </div>
            {lastRareLabel && (
                <div key={lastRareLabel} className="self-center mt-1 bg-slate-800/80 text-amber-300 text-xs font-bold px-3 py-1 rounded-full animate-[pop_0.3s]">{lastRareLabel}</div>
            )}
        </div>
    );

    const BeatIndicator = (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3">
            <div
                onPointerDown={inputMode === 'tap' ? (e) => { e.preventDefault(); handleTap(); } : undefined}
                className={`w-64 h-64 rounded-full border-8 border-white flex items-center justify-center backdrop-blur-sm transition-transform duration-75 ${fever ? 'bg-orange-200/40' : 'bg-pink-200/30'} ${isHitAnimating ? 'scale-110' : 'scale-100'} ${inputMode === 'tap' ? 'cursor-pointer active:scale-95 touch-none select-none' : ''}`}
            >
                <div className={`w-48 h-48 bg-gradient-to-b ${fever ? 'from-orange-400 to-pink-500' : 'from-pink-400 to-pink-500'} rounded-full flex items-center justify-center shadow-[0_8px_0_rgba(219,39,119,0.2)] border-4 border-white transition-all duration-75 ${isHitAnimating ? 'brightness-110' : ''}`}>
                     <span className="text-6xl font-black text-white drop-shadow-md select-none">な！</span>
                </div>
            </div>
            {inputMode === 'tap' && (
                <div className="bg-white/80 text-slate-500 text-xs font-bold px-3 py-1 rounded-full border-2 border-white shadow pointer-events-none">
                    ビートに合わせてタップ（PC：スペースキー）
                </div>
            )}
        </div>
    );

    // ゲーム中のしあしあ（左下）
    const ShiashiaStage = (
        <div className="absolute bottom-0 left-0 z-30 md:left-6">
            <Shiashia3D beatRef={lastBeatTimeRef} hitRef={hitRef} mood="dance" intensity={Math.min(1, combo / 40)} size={isMobile ? 150 : 240} onPoke={handlePoke} />
        </div>
    );

    if (gameState === 'PAUSED') {
        return (
             <>
                <div className="absolute inset-0 pointer-events-none opacity-50 filter blur-sm">
                   {HUD}
                   {BeatIndicator}
                </div>
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white/90 p-8 rounded-[3rem] border-8 border-yellow-300 shadow-2xl flex flex-col items-center gap-6 animate-[pop_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] min-w-[320px]">
                        <h2 className="text-4xl font-black text-slate-700 mb-2">一 時 停 止</h2>
                        <button onClick={handleResume} className="w-64 py-4 text-xl font-bold text-white bg-pink-500 rounded-full border-4 border-white shadow-lg hover:scale-105 active:scale-95 transition-all">引き続きプレイ</button>
                        <button onClick={handleStart} className="w-64 py-4 text-xl font-bold text-slate-600 bg-yellow-300 rounded-full border-4 border-white shadow-lg hover:scale-105 active:scale-95 transition-all">初めから</button>
                        <button onClick={handleQuit} className="w-64 py-4 text-xl font-bold text-slate-500 bg-gray-200 rounded-full border-4 border-white shadow-lg hover:scale-105 active:scale-95 transition-all">終了</button>
                    </div>
                </div>
             </>
        );
    }

    switch(gameState) {
      case 'READY':
        return (
          <div className="w-full h-full overflow-y-auto overflow-x-hidden relative z-10 scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-transparent">
            <div className="min-h-full flex flex-col items-center justify-center p-4 py-8 md:py-4">

            {/* Title Section */}
            <div className="relative mb-6 md:mb-8 flex flex-col items-center text-center z-20">
                <div className="mb-2 bg-yellow-300 text-slate-800 px-4 py-1 rounded-full font-black text-xs md:text-sm border-2 md:border-4 border-white shadow-md transform -rotate-2">
                    底辺チューバーからの脱却
                </div>
                <div className="flex items-center gap-2">
                    {/* タイトル横のしあしあ（PC） */}
                    {!isMobile && (
                        <div className="-mr-6">
                            <Shiashia3D beatRef={lastBeatTimeRef} hitRef={hitRef} mood="dance" intensity={0.3} size={190} onPoke={handlePoke} />
                        </div>
                    )}
                    <div className="flex flex-col items-center transform -rotate-1 hover:scale-105 transition-transform duration-300 cursor-pointer py-2 select-none" onClick={handleTitleClick}>
                        <div className="flex items-end justify-center flex-wrap gap-x-2">
                            <span className="text-6xl sm:text-8xl md:text-[8rem] font-black text-pink-500 leading-none drop-shadow-xl" style={{ WebkitTextStroke: '3px white', paintOrder: 'stroke fill' }}>名</span>
                            <span className="text-2xl sm:text-4xl md:text-4xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2px white', paintOrder: 'stroke fill' }}>を</span>
                            <span className="text-4xl sm:text-6xl md:text-6xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2.5px white', paintOrder: 'stroke fill' }}>たくさん</span>
                            <span className="text-3xl sm:text-5xl md:text-5xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2px white', paintOrder: 'stroke fill' }}>伝えれる</span>
                        </div>
                        <div className="flex items-baseline justify-center mt-1">
                            <span className="text-3xl sm:text-5xl md:text-7xl font-black text-slate-800" style={{ WebkitTextStroke: '3px white', paintOrder: 'stroke fill' }}>画期的ツール</span>
                        </div>
                    </div>
                </div>
                <div className="text-slate-400 text-[10px] md:text-xs font-bold mt-2 tracking-widest bg-white/50 px-3 py-1 rounded-full">的なもの</div>

                {/* スマホ用しあしあ */}
                {isMobile && (
                    <div className="mt-1">
                        <Shiashia3D beatRef={lastBeatTimeRef} hitRef={hitRef} mood="dance" intensity={0.3} size={140} onPoke={handlePoke} />
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-4 w-full max-w-4xl items-stretch justify-center">
                {/* LEFT: Start & Mode Selection */}
                <div className="flex-1 flex flex-col gap-4 order-1">
                     <div className="bg-white/80 backdrop-blur rounded-2xl p-3 shadow-[0_4px_0_rgba(0,0,0,0.1)] flex flex-col gap-2 border-4 border-white">
                         <div className="text-cyan-500 font-bold text-center text-sm mb-1">モードをえらんでね</div>
                         <div className="flex gap-2">
                            {(Object.keys(MODE_DURATIONS) as GameMode[]).map((mode) => (
                                <button key={mode} onClick={() => { setGameMode(mode); gameModeRef.current = mode; setTimeout(loadScores, 0); }}
                                    className={`flex-1 py-2 font-bold text-xs md:text-base rounded-xl transition-all transform ${gameMode === mode ? 'bg-yellow-300 text-slate-800 shadow-[0_3px_0_#d97706] translate-y-[-1px]' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                    {mode === 'FULL' ? 'フル (73秒)' : mode === '10s' ? '10秒' : '30秒'}
                                </button>
                            ))}
                         </div>
                     </div>

                     <button onClick={handleStart} className="group relative flex-1 w-full focus:outline-none transform transition-all hover:scale-[1.02] active:scale-95 duration-200 min-h-[100px] md:min-h-[160px]">
                        <div className="absolute inset-0 bg-pink-300 rounded-[2rem] transform translate-y-2"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-pink-400 to-pink-500 rounded-[2rem] border-4 border-white shadow-inner flex flex-col items-center justify-center overflow-hidden">
                            <div className="absolute top-[-20%] left-[-10%] w-32 h-32 bg-white/20 rotate-45 transform"></div>
                            <div className="absolute bottom-[-20%] right-[-10%] w-32 h-32 bg-white/20 rotate-12 transform"></div>
                            <span className="text-4xl md:text-5xl font-black text-white drop-shadow-md z-10">始める！</span>
                            <div className="bg-white/30 rounded-full px-6 py-2 mt-4 md:mt-6 z-10">
                                <span className="text-lg md:text-2xl font-bold text-white">
                                    {gameMode === 'FULL' ? '73秒名を伝える' : gameMode === '10s' ? '10秒名を伝える' : '30秒名を伝える'}
                                </span>
                            </div>
                        </div>
                    </button>

                     {/* ずかんボタン */}
                     <button onClick={() => setShowBook(true)} className="w-full bg-white/80 backdrop-blur rounded-2xl p-3 border-4 border-white shadow-[0_4px_0_rgba(0,0,0,0.1)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between">
                         <span className="font-black text-slate-700 text-lg">📖 ずかん</span>
                         <span className="text-xs font-bold text-slate-400">
                             🏆 {Object.keys(unlocked).length}/{ACHIEVEMENTS.length} · 🎬 {Object.keys(seenEndings).length}/{TOTAL_ENDINGS}
                         </span>
                     </button>
                </div>

                {/* RIGHT: Settings Panel */}
                <div className="flex-1 order-2">
                     <div className="h-full bg-sky-200/90 backdrop-blur rounded-[2rem] border-4 md:border-8 border-white p-4 text-slate-700 flex flex-col justify-center gap-4 shadow-lg relative overflow-hidden">
                         <div className="absolute top-[-20px] left-[-20px] w-20 h-20 bg-sky-300 rounded-full opacity-50"></div>
                         <div className="bg-white text-sky-500 font-black px-4 py-1 rounded-full inline-block self-center mb-2 shadow-sm text-lg border-2 border-sky-100">⚙️ せってい</div>

                         <div className="bg-white/50 p-3 rounded-xl">
                             <div className="flex justify-between mb-1 font-bold text-sky-600 text-sm">
                                 <span>🔊 おんりょう</span>
                                 <span>{Math.round(volume * 100)}%</span>
                             </div>
                             <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full accent-yellow-400" />
                         </div>

                         <div className="bg-white/50 p-3 rounded-xl">
                             <div className="font-bold text-sky-600 mb-1 text-sm">📁 BGMをえらぶ</div>
                             <input type="file" accept="audio/*" onChange={handleBgmSelect}
                                 className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer mb-2" />
                             <input type="text" placeholder="またはURLを入力 (GitHub Rawなど)" value={customUrl} onChange={handleUrlChange}
                                 className="w-full text-xs p-2 rounded-lg border-2 border-sky-200 text-slate-600 bg-white focus:outline-none focus:border-sky-400" />
                             <div className="text-[10px] text-slate-400 mt-1 leading-tight">※Github等のURLを直接指定できます</div>
                         </div>

                         {/* 入力モード */}
                         {!TAP_ONLY && (
                         <div className="bg-white/50 p-3 rounded-xl">
                             <div className="font-bold text-sky-600 mb-2 text-sm">🎮 にゅうりょく</div>
                             <div className="flex gap-2">
                                 {([['mic', '🎤 声で「な」'], ['tap', '👆 タップ / スペース']] as const).map(([m, label]) => (
                                     <button key={m} onClick={() => setInputMode(m)}
                                         className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${inputMode === m ? 'bg-yellow-300 text-slate-800 shadow-[0_3px_0_#d97706]' : 'bg-white text-slate-400'}`}>
                                         {label}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         )}
                         {TAP_ONLY && (
                         <div className="bg-white/50 p-3 rounded-xl text-xs text-slate-500 font-bold leading-relaxed">
                             👆 この公開版はタップ / スペースキーで「な」を伝えます。<br/>
                             （声で遊ぶには GitHub のプロジェクトをローカルで起動）
                         </div>
                         )}

                         {!TAP_ONLY && (
                         <div className={`bg-white/60 p-3 rounded-xl flex-1 flex flex-col justify-center border-2 border-white gap-2 ${inputMode === 'tap' ? 'opacity-50' : ''}`}>
                             <div className="flex justify-between items-center">
                                 <span className="font-bold text-sky-600 text-sm">🎤 マイクテスト</span>
                                 <button onClick={toggleMicTest} className={`px-3 py-1 text-xs font-bold rounded-full border-2 transition-colors ${isMicTesting ? 'bg-green-400 text-white border-green-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                                     {isMicTesting ? 'ON' : 'OFF'}
                                 </button>
                             </div>
                             <div>
                                 <select className="w-full text-xs p-2 rounded-lg border-2 border-sky-200 text-slate-600 bg-white focus:outline-none focus:border-sky-400 max-w-full truncate" value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
                                     {audioDevices.length === 0 && <option value="">マイクをさがしています...</option>}
                                     {audioDevices.map(device => (
                                         <option key={device.deviceId} value={device.deviceId}>{device.label || `マイク ${device.deviceId.slice(0, 5)}...`}</option>
                                     ))}
                                 </select>
                             </div>
                             <div className="relative h-8 bg-gray-200 rounded-full border-4 border-white overflow-hidden shadow-inner">
                                 <div className="absolute top-0 bottom-0 w-1 bg-yellow-400 z-20" style={{ left: `${micThreshold}%` }}></div>
                                 <div className={`absolute top-0 left-0 bottom-0 transition-all duration-100 ease-out rounded-l-full ${inputLevel > micThreshold ? 'bg-green-400' : 'bg-sky-400'}`} style={{ width: `${inputLevel}%` }}></div>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">はんのうライン</span>
                                <input type="range" min="0" max="100" value={micThreshold} onChange={(e) => setMicThreshold(parseInt(e.target.value))} className="flex-1 h-2 opacity-80" />
                             </div>
                         </div>
                         )}
                     </div>
                </div>
            </div>

            {error && <div className="mt-4 bg-red-400 text-white font-bold p-3 rounded-xl border-4 border-white animate-bounce shadow-lg max-w-lg text-center text-sm break-all">{error}</div>}

            </div>
          </div>
        );
      case 'COUNTDOWN':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-[12rem] md:text-[16rem] font-black text-white drop-shadow-[0_8px_0_rgba(236,72,153,1)] animate-impact" style={{WebkitTextStroke: '4px #ec4899'}}>
              {countdown > 0 ? countdown : 'スタート!'}
            </div>
          </div>
        );
      case 'PLAYING':
        return (
          <>
            <button onClick={handlePause} className="absolute top-4 left-4 z-50 bg-white/90 text-slate-500 hover:bg-yellow-300 hover:text-white border-4 border-slate-200 hover:border-white rounded-full p-3 font-bold shadow-md transition-all active:scale-95" aria-label="一時停止">
                <span className="block w-8 h-8 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                </span>
            </button>
            {HUD}
            {BeatIndicator}
            {ShiashiaStage}
          </>
        );
      case 'ENDING':
        return ending ? (
          <EndingScene ending={ending} beatRef={lastBeatTimeRef} hitRef={hitRef} isNew={endingIsNew} onDone={handleEndingDone} />
        ) : null;
      case 'FINISHED':
        return (
          <div className="w-full h-full overflow-y-auto relative z-20">
          <div className="min-h-full text-center flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6 relative justify-center">
            {isCleared && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full z-0 pointer-events-none">
                     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-red-500 to-orange-500 rounded-full opacity-20 animate-pulse blur-3xl"></div>
                </div>
            )}

            <h2 className="text-6xl md:text-9xl font-black text-pink-500 drop-shadow-[4px_4px_0_#fff] mb-4 animate-impact tracking-tight z-10">おしまい！</h2>

            {/* 到達エンディング */}
            {ending && (
                <div className="mb-4 z-10 bg-slate-800 text-white rounded-2xl px-5 py-2 border-4 border-white shadow-lg flex items-center gap-3">
                    <div className="text-left">
                        <div className="text-[10px] tracking-widest text-white/60">ENDING No.{String(ending.no).padStart(2, '0')}</div>
                        <div className="font-black text-lg md:text-xl">{ending.title}</div>
                    </div>
                    {endingIsNew && <span className="bg-yellow-300 text-slate-800 font-black px-2 py-1 rounded-full text-xs -rotate-6">NEW!</span>}
                </div>
            )}

            {isCleared && (
                 <div className="mb-4 z-10 animate-bounce">
                     <p className="text-lg md:text-2xl font-black text-red-500 bg-yellow-200 px-6 py-2 rounded-full border-4 border-white shadow-lg">（あなたの名を伝えすぎて、世界が爆発しました）</p>
                 </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 items-center w-full justify-center z-10">
                <div className="bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-[3rem] border-8 border-yellow-300 shadow-xl flex flex-col items-center transform rotate-[-2deg] min-w-[300px]">
                    <p className="text-xl text-yellow-500 font-bold mb-2">チャンネル登録者数</p>
                    <p className="text-5xl md:text-6xl font-black text-slate-700">{subscribers.toLocaleString()} <span className="text-2xl">人</span></p>
                    <div className="mt-4 bg-gray-100 rounded-xl px-4 py-2 w-full flex justify-between">
                         <span className="font-bold text-gray-500">伝えた回数</span>
                         <span className="font-black text-slate-700">{score}回</span>
                    </div>
                    <div className="mt-2 bg-gray-100 rounded-xl px-4 py-2 w-full flex justify-between">
                         <span className="font-bold text-gray-500">最大コンボ</span>
                         <span className="font-black text-pink-500">{maxCombo}</span>
                    </div>
                    <div className="mt-2 bg-gray-100 rounded-xl px-4 py-2 w-full flex justify-between text-sm">
                         <span className="font-bold text-gray-500">⭐{runRef.current.goldClicks} 💎{runRef.current.diamondClicks} 🔥{runRef.current.feverCount}</span>
                         <span className="font-bold text-gray-500">レア {runRef.current.rareSeen} / 超 {runRef.current.ultraSeen}</span>
                    </div>
                    {isCleared && <p className="text-red-500 font-black mt-4 text-3xl animate-pulse">CLEAR!</p>}
                </div>

                <div className="bg-sky-100/90 p-6 rounded-[2rem] border-4 border-white shadow-lg w-full max-w-sm transform rotate-[2deg]">
                    <div className="bg-sky-400 text-white text-xl font-black py-2 px-6 rounded-full inline-block mb-4 shadow-sm">ランキング (人数)</div>
                    <ul className="space-y-2">
                        {highScores.map((entry, i) => (
                            <li key={i} className={`flex justify-between items-center px-4 py-2 rounded-xl ${i === 0 ? 'bg-yellow-100 text-yellow-600 font-black border-2 border-yellow-200' : 'bg-white/50 text-slate-600 font-bold'}`}>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span>#{i + 1}</span>
                                        <span className="text-lg">{entry.score.toLocaleString()}人</span>
                                    </div>
                                    <span className="text-xs text-slate-400 ml-6">({entry.hitCount || 0}回{entry.endingId ? ` · ${ENDINGS.find((e) => e.id === entry.endingId)?.title ?? ''}` : ''})</span>
                                </div>
                            </li>
                        ))}
                        {highScores.length === 0 && <li className="text-gray-400 text-center py-4">まだきろくがないよ</li>}
                    </ul>
                </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center z-10">
                <button onClick={handlePlayAgain} className="group relative inline-block focus:outline-none transform transition-transform hover:scale-105 active:scale-95">
                  <span className="absolute inset-0 translate-y-2 bg-pink-300 rounded-full"></span>
                  <span className="relative inline-block border-4 border-white px-12 py-4 text-2xl font-black text-white bg-pink-500 rounded-full shadow-lg group-hover:-translate-y-1 transition-transform">もういちどあそぶ</span>
                </button>
                <button onClick={() => setShowBook(true)} className="bg-white text-slate-700 font-black px-8 py-3 rounded-full border-4 border-yellow-300 shadow-lg hover:scale-105 active:scale-95 transition-transform">📖 ずかんを見る</button>
            </div>
          </div>
          </div>
        );
    }
  };

  const bgClass = fever && gameState === 'PLAYING' ? 'bg-fever' : 'bg-polka';

  return (
    <div className={`w-full h-full flex items-center justify-center relative overflow-hidden ${bgClass} font-sans selection:bg-pink-200 selection:text-pink-900 ${shakeClass} ${worldInvert ? 'world-invert' : ''}`}>
        <audio ref={bgmRef} loop preload="auto" src={bgmSource}
            onCanPlay={() => { setError(null); }}
            onError={() => { console.warn("BGM Load Error:", bgmSource); setError("BGMの読み込みに失敗しました: " + bgmSource); }}
        />
        <audio ref={menuBgmRef} loop preload="auto" src={menuBgmUrl} onError={() => console.warn("Menu BGM not found")} />

        {gameState !== 'ENDING' && <Crowd progress={Math.min(score / CLEAR_THRESHOLDS[gameMode], 1)} fever={fever} />}
        <NaEffects particles={particles} onClickSpecial={handleSpecialClick} />

        {/* ヒット文字 / スコアポップ */}
        {hitWords.map((w) => (
            <div key={w.id} className={`hit-word absolute z-30 pointer-events-none font-black text-3xl md:text-5xl ${w.color} drop-shadow-[3px_3px_0_#fff]`} style={{ left: w.left, top: w.top, WebkitTextStroke: '1px #fff' }}>{w.text}</div>
        ))}
        {scorePops.map((s) => (
            <div key={s.id} className="score-pop absolute top-[36%] z-30 pointer-events-none font-black text-2xl md:text-3xl text-emerald-500 drop-shadow-[2px_2px_0_#fff]" style={{ left: s.left }}>{s.text}</div>
        ))}

        {fever && gameState === 'PLAYING' && <div className="fever-glow absolute inset-0 z-[1] pointer-events-none" />}
        {flash && <div className="absolute inset-0 bg-white z-[55] flash-white pointer-events-none" />}

        {renderContent()}

        <CutIn cutIn={cutIn} beatRef={lastBeatTimeRef} hitRef={hitRef} />
        <AchievementToasts toasts={toasts} />
        {showBook && <CollectionBook unlocked={unlocked} seenEndings={seenEndings} seenVariants={seenVariants} onClose={() => setShowBook(false)} />}
    </div>
  );
};

export default Game;
