import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, GameMode, Difficulty, ScoreEntry, NaParticle, NaVariant, Rarity, RunStats, Ending } from '../types';
import { MODE_LABEL, MODE_DESC, LS_KEYS, DIFF_LABEL, DIFF_DESC } from '../constants';
import { buildChart, BEAT, EIGHTH } from '../utils/chart';
import { JudgeEngine, NoteState, BurnState } from '../utils/judge';
import {
  gainFor, VIEWERS, FUEL_LOSS, BAN_STRIKES, BUZZ_EIGHTHS, QUOTA, MILESTONES, fmtSubs, Judge, comboMul, viewerMul,
} from '../utils/economy';
import { SongPlayer, playJingle } from '../utils/songPlayer';
import { MicDetector } from '../utils/micDetector';
import { rollItem, ItemDef, ItemId, ITEM_COLOR } from '../utils/items';
import { rollRarity, pickVariant, createParticles } from '../utils/naEffects';
import { ACHIEVEMENTS, achievementById, evaluate, loadUnlocked, saveUnlocked, loadLifetime, saveLifetime, LifetimeStats } from '../utils/achievements';
import { ENDINGS, TOTAL_ENDINGS, pickEnding, loadSeenEndings, saveSeenEndings, countSeen, byId as endingById } from '../utils/endings';
import NaEffects from './NaEffects';
import Shiashia3D, { ShiashiaMood } from './Shiashia3D';
import ShiashiaSeated, { STORY, Reaction } from './ShiashiaSeated';
import KiaKiaPunch from './KiaKiaPunch';
import GlassCrack from './GlassCrack';
import ScreenDeath from './ScreenDeath';
import { NaBubbles, FortuneCard } from './TitleToys';
import { sfxBoing } from '../utils/titleSfx';
import { playSfx, playSfxAt, preloadSfx, installButtonSfx, cancelPendingSfx, playTap, SfxId, SfxOpt } from '../utils/sfx';
import Track from './Track';
import HeavenStage from './HeavenStage';
import BurnFx, { BurnFxData } from './BurnFx';
import { pickBurnPatterns, planBurn, judgeBurn, BURN_INFO, BurnPattern } from '../utils/burnChallenge';
import { perf, guessLite } from '../utils/perf';
import { buildStyleSchedule, segIndexAt, StyleSeg, TrackStyle, STYLE_INFO, heavenCallResponse, heavenGameAt, HEAVEN_SFX, HEAVEN_FAIL_SFX, HEAVEN_GAMES } from '../utils/arcade';
import EventCutIn, { CutInData } from './EventCutIn';
import CommentStream, { CommentMood } from './CommentStream';
import Calibration from './Calibration';
import RulesCard from './RulesCard';
import AchievementToasts, { ToastItem } from './AchievementToast';
import EndingScene from './EndingScene';
import { loadRH } from '../utils/rhLoader';
import ResultScreen from './ResultScreen';
import CollectionBook from './CollectionBook';

/* ============================================================
 * 設定・保存
 * ============================================================ */
const TAP_ONLY = !!process.env.TAP_ONLY;           // マイクを使わない版を作るとき（ビルド時に TAP_ONLY=1）
const ASSET_BASE = (process.env.ASSET_BASE as string) || 'https://raw.githubusercontent.com/mshinyukari/-/main/';
const DEFAULT_BGM = ASSET_BASE + 'bgm/bgm.mp3';
/** カウント「3・2・3・2・1・GO」：[声, 最初の「な」の何拍前, 画面の文字] */
const COUNT_IN: [SfxId, number, string][] = [['v3', 8, '3'], ['v2', 6, '2'], ['v3', 4, '3'], ['v2', 3, '2'], ['v1', 2, '1'], ['v_go', 1, 'GO!']];
/** タイトル（OP）の曲。設定で切り替えられる */
type MenuBgm = 'chip' | 'chip1' | 'original';
const MENU_BGMS: { id: MenuBgm; label: string; file: string }[] = [
  { id: 'chip', label: 'チップチューン', file: 'bgm/top_chip.mp3' },
  { id: 'chip1', label: '前のチップ', file: 'bgm/top_chip_v1.mp3' },
  { id: 'original', label: '原曲', file: 'bgm/top.mp3' },
];

interface Settings { volume: number; input: 'mic' | 'tap'; tapMode: 'easy' | 'normal'; deviceId: string; threshold: number; clicks: boolean; menuBgm: MenuBgm; arcade: boolean; difficulty: Difficulty; lite: boolean; hitSound: boolean; voice: boolean }
const DEFAULT_SETTINGS: Settings = { volume: 0.6, input: 'tap', tapMode: 'easy', deviceId: '', threshold: 30, clicks: true, menuBgm: 'chip', arcade: true, difficulty: 'normal', lite: guessLite(), hitSound: true, voice: true };
const loadJSON = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };
const saveJSON = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } };
type Offsets = { mic: number | null; tap: number | null };
/** キーボードで遊ぶときのキー（どれでも同じ） */
const PLAY_KEYS = new Set(['Space', 'Enter', 'KeyN', 'KeyF', 'KeyJ', 'KeyD', 'KeyK']);
const INPUT_LABEL = { tap: 'キーボード・タップ', mic: '声' } as const;

const emptyRun = (mode: GameMode, difficulty: Difficulty = 'normal', notesTotal = 0): RunStats => ({
  mode, difficulty, notesTotal, subs: 0, quota: QUOTA[mode], cleared: false, hits: 0, perfect: 0, great: 0, good: 0, misses: 0, extras: 0,
  fuels: 0, burnsKept: 0, burnsTotal: 0, maxCombo: 0, buzzes: 0, items: 0, pokes: 0, pauses: 0, cutoff: false, ban: false, finished: false, stylesSeen: 0, styleClean: 0,
  input: 'tap', holdsOk: 0, holdsTotal: 0, powerOk: 0, powerTotal: 0,
});

const EVENT_MOOD: Record<string, ShiashiaMood> = {
  sing: 'sing', game: 'game', collab: 'dance', asmr: 'asmr', live: 'celebrate', world: 'celebrate', burn: 'shock', ban: 'ban',
};

/* ============================================================
 * 小さい部品
 * ============================================================ */

/** 登録者数：目標に向かってなめらかに回る（インフレ感） */
const SubsCounter: React.FC<{ value: number; big?: boolean }> = ({ value, big }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const subRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const target = useRef(value);
  target.current = value;
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const d = target.current - shown.current;
      shown.current += Math.abs(d) < 1 ? d : d * Math.min(1, dt * 9);
      // 文字が変わったときだけ書きかえる（毎コマ書くと、そのたびに描き直しになる）
      const a = fmtSubs(shown.current), b = shown.current >= 10000 ? `${Math.floor(shown.current).toLocaleString('ja-JP')}人` : '';
      if (ref.current && ref.current.textContent !== a) ref.current.textContent = a;
      if (subRef.current && subRef.current.textContent !== b) subRef.current.textContent = b;
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="flex flex-col items-center leading-none">
      <span className={`font-black text-slate-800 tracking-tight tabular-nums ${big ? 'text-4xl sm:text-5xl md:text-6xl' : 'text-4xl'}`}>
        <span ref={ref}>0</span><span className="text-xl md:text-2xl text-slate-500 ml-1">人</span>
      </span>
      <span ref={subRef} className="text-[10px] md:text-xs font-bold text-slate-400 tabular-nums mt-0.5" />
    </span>
  );
};

/** マイクの音量メーター（毎フレーム直接書き換える） */
const LevelMeter: React.FC<{ mic: MicDetector; threshold: number }> = ({ mic, threshold }) => {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (bar.current) {
        bar.current.style.width = `${mic.level}%`;
        bar.current.style.background = mic.level > mic.threshold ? '#4ade80' : '#38bdf8';
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mic]);
  return (
    <div className="relative h-7 bg-gray-200 rounded-full border-4 border-white overflow-hidden shadow-inner">
      <div className="absolute top-0 bottom-0 w-1 bg-yellow-400 z-10" style={{ left: `${threshold}%` }} />
      <div ref={bar} className="absolute top-0 left-0 bottom-0 rounded-l-full" style={{ width: 0 }} />
    </div>
  );
};

/** 観客（登録者が増えるほど増える） */
const Crowd: React.FC<{ subs: number; buzz: boolean }> = ({ subs, buzz }) => {
  const rows = [subs >= 1e3, subs >= 1e5, subs >= 1e7];
  const col = buzz ? ['bg-pink-200', 'bg-pink-300', 'bg-pink-400'] : ['bg-gray-200', 'bg-gray-300', 'bg-gray-400'];
  return (
    <div className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none z-[1] overflow-hidden">
      {[8, 7, 6].map((n, r) => (
        <div key={r} className={`absolute left-[-10%] w-[120%] h-full flex justify-around items-end transition-transform duration-700 ${rows[r] ? 'translate-y-0' : 'translate-y-full'}`} style={{ bottom: -50 + r * 20 }}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className={`${col[r]} rounded-t-full mx-1 origin-bottom`} style={{ width: 96 + r * 32, height: 128 + r * 32, animation: rows[r] ? `crowd-jump ${0.6 - r * 0.1}s infinite` : 'none', animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ))}
    </div>
  );
};

/* ============================================================
 * 本体
 * ============================================================ */
const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('READY');
  const gameStateRef = useRef<GameState>('READY');
  gameStateRef.current = gameState;
  const [mode, setMode] = useState<GameMode>('30s');
  const [settings, setSettingsState] = useState<Settings>(() => loadJSON(LS_KEYS.settings, DEFAULT_SETTINGS));
  const setSettings = (p: Partial<Settings>) => setSettingsState((s) => { const n = { ...s, ...p }; saveJSON(LS_KEYS.settings, n); return n; });
  const [offsets, setOffsetsState] = useState<Offsets>(() => loadJSON(LS_KEYS.offsets, { mic: null, tap: null } as Offsets));
  const setOffset = (k: 'mic' | 'tap', v: number | null) => setOffsetsState((o) => { const n = { ...o, [k]: v }; saveJSON(LS_KEYS.offsets, n); return n; });
  const offsetsRef = useRef(offsets); offsetsRef.current = offsets;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  /**
   * 効果音（フリー素材）。inPlay＝プレイ中に鳴らす音。声で遊んでいるときはマイクが拾って「な」と数えてしまうので鳴らさない
   */
  const se = (id: SfxId, o: SfxOpt = {}, inPlay = false) => {
    if (inPlay && !TAP_ONLY && settingsRef.current.input === 'mic' && gameStateRef.current === 'PLAYING') return false;
    const pc = playerRef.current?.ctx;
    return playSfx(id, { volume: settingsRef.current.volume, ctx: pc && pc.state === 'running' ? pc : null, ...o });
  };
  const voiceOn = () => settingsRef.current.voice !== false;
  // かるいモード（設定、またはプレイ中に重いと分かったら自動で）
  const [liteAuto, setLiteAuto] = useState(false);
  const lite = !!settings.lite || liteAuto;
  perf.lite = lite;
  const input: 'mic' | 'tap' = TAP_ONLY ? 'tap' : settings.input;
  const [skipRules, setSkipRules] = useState(() => { try { return localStorage.getItem(LS_KEYS.skipRules) === '1'; } catch { return false; } });
  const [bgmUrl, setBgmUrl] = useState(DEFAULT_BGM);
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 800, h: typeof window !== 'undefined' ? window.innerHeight : 600 });
  const isMobile = vp.w < 768;
  const isMobileRef = useRef(isMobile); isMobileRef.current = isMobile;

  // --- 永続データ ---
  const [unlocked, setUnlocked] = useState<Record<string, number>>(() => loadUnlocked());
  const unlockedRef = useRef(unlocked); unlockedRef.current = unlocked;
  const [seenEndings, setSeenEndings] = useState<Record<string, number>>(() => loadSeenEndings());
  const lifeRef = useRef<LifetimeStats>(loadLifetime());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);

  // --- 音 ---
  const playerRef = useRef<SongPlayer | null>(null);
  const [songReady, setSongReady] = useState(false);
  const micRef = useRef<MicDetector>(new MicDetector());
  const [micOn, setMicOn] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const menuBgmRef = useRef<HTMLAudioElement>(null);

  // --- プレイ中（毎フレーム触るものは ref） ---
  const engineRef = useRef<JudgeEngine | null>(null);
  const notesRef = useRef<NoteState[]>([]);
  const burnsRef = useRef<BurnState[]>([]);
  const flagsRef = useRef({ mirror: false, hidden: false, nu: false, buzz: false, lastHit: 0, lastJudge: '' });
  // 背景の「な」は飾り（クリックでは何も起きない。special「な」は別）
  const runRef = useRef<RunStats>(emptyRun('30s'));
  const chartRef = useRef(buildChart('30s'));
  const subsRef = useRef(0);
  const peakSubsRef = useRef(0);
  const comboRef = useRef(0);
  const viewersRef = useRef(VIEWERS.start);
  const strikesRef = useRef(0);
  const buzzUntilRef = useRef(-1);
  const effectsRef = useRef<{ id: ItemId; until: number }[]>([]);
  const milestoneIdxRef = useRef(0);
  const nextSpecialRef = useRef(7);
  const announcedRef = useRef<Set<number>>(new Set());
  const finishingRef = useRef(false);
  const pauseAtRef = useRef(0);
  const hitRef = useRef(0);
  // 強弱・伸ばし
  const keysDownRef = useRef<Set<string>>(new Set());          // 押しているキー
  const pointersDownRef = useRef<Set<number>>(new Set());      // 画面に触れている指
  const lastHitRef = useRef<{ note: NoteState; at: number; src: 'mic' | 'tap' } | null>(null);
  const activeHoldRef = useRef<NoteState | null>(null);        // 伸ばし中の音符
  const holdGapRef = useRef<number | null>(null);              // 声・指・キーが離れた時刻（少しの途切れは許す）
  const voicePeaksRef = useRef<number[]>([]);                  // 最近の声の大きさ（ふつうの声の基準）
  const cutQueueRef = useRef<CutInData[]>([]);
  const cutTimerRef = useRef<number | null>(null);
  const cutCurRef = useRef<CutInData | null>(null);
  const runUnlockedRef = useRef<string[]>([]);
  const isNewRecordRef = useRef(false);
  const prevBestRef = useRef(0);

  // --- プレイ中（画面に出すもの） ---
  const [subs, setSubs] = useState(0);
  const [combo, setCombo] = useState(0);
  const [viewers, setViewers] = useState(VIEWERS.start);
  const [strikes, setStrikes] = useState(0);
  const [judge, setJudge] = useState<{ id: number; text: string; cls: string } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  // 上の時間のバー：毎回 Game ぜんぶを描き直さないよう、バーの幅だけ直接書きかえる
  const timeBarRef = useRef<HTMLDivElement>(null);
  const setTimePct = (v: number) => { if (timeBarRef.current) timeBarRef.current.style.transform = `scaleX(${v})`; };
  const [buzz, setBuzz] = useState(false);
  const [commentMood, setCommentMood] = useState<CommentMood>('normal');
  const [cutIn, setCutIn] = useState<CutInData | null>(null);
  const [tempMood, setTempMood] = useState<ShiashiaMood | null>(null);
  const [specials, setSpecials] = useState<{ id: number; top: number; dur: number }[]>([]);
  const [itemCard, setItemCard] = useState<{ id: number; def: ItemDef; until: number; total: number } | null>(null);
  const [activeFx, setActiveFx] = useState<ItemId[]>([]);
  const [particles, setParticles] = useState<NaParticle[]>([]);
  const [shake, setShake] = useState('');
  const [ending, setEnding] = useState<Ending | null>(null);
  const [endingIsNew, setEndingIsNew] = useState(false);
  const luckyRef = useRef(false);                 // タイトルの虹色の「な」から入ったエンディング（終わったらタイトルへ戻る）
  const [luckyFx, setLuckyFx] = useState(false);
  const [revealT, setRevealT] = useState(0);
  const [banFlash, setBanFlash] = useState(false);
  const [storyIdx, setStoryIdx] = useState(0);
  // タイトル画面のおまけ
  const seatedReactRef = useRef<((r: Reaction) => void) | null>(null);
  const styleBannerIdRef = useRef(-1);
  const titlePokeRef = useRef({ n: 0, at: 0 });
  const [reactSay, setReactSay] = useState<{ id: number; text: string } | null>(null);
  const [kiaOn, setKiaOn] = useState(false);
  /** きあきあを呼んだ回数（3 回で画面がこわれてゲームオーバー → きれいな画面に戻って 0 から） */
  const kiaCountRef = useRef(0);
  const [deathOn, setDeathOn] = useState(false);
  /** 炎上の結果の演出（大炎上・鎮火） */
  const [burnFx, setBurnFx] = useState<BurnFxData | null>(null);
  const burnFxShownRef = useRef(new Set<number>());
  const holdGapBurnRef = useRef<number | null>(null);
  const [crackSeed, setCrackSeed] = useState<number | null>(null);
  const [crackLevel, setCrackLevel] = useState(1);     // 何回目の割れか（回数が増えるほどひどく割れる）
  const [crackFixing, setCrackFixing] = useState(false);
  const [showFortune, setShowFortune] = useState(false);
  const [titlePops, setTitlePops] = useState(() => lifeRef.current.titlePops ?? 0);
  const [logo, setLogo] = useState({ i: 0, id: 0 });
  const [showSettings, setShowSettings] = useState(false);
  // 画面チェンジ（譜面の見た目が音ゲー風に切り替わる）
  const scheduleRef = useRef<StyleSeg[]>([{ t: -1e9, style: 'lane' }]);
  const heavenCueRef = useRef<Set<number>>(new Set());     // してみた動画：予約したお手本の音
  const segDirtyRef = useRef<Set<number>>(new Set());
  const lastSegRef = useRef(0);
  const [trackStyle, setTrackStyle] = useState<TrackStyle>('lane');
  const [styleBanner, setStyleBanner] = useState<{ id: number; style: TrackStyle } | null>(null);
  const settingsBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (showSettings) setTimeout(() => settingsBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [showSettings]);

  const quota = QUOTA[mode];
  const chaos = Math.min(1, Math.log10(subs + 1) / 8);

  /* ---------------- 共通 ---------------- */
  // 効果音：先に読み込んでおく＋ボタンを押したときの音
  useEffect(() => { preloadSfx(); return installButtonSfx(() => settingsRef.current.volume); }, []);
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pushToasts = (ids: string[]) => {
    if (!ids.length) return;
    const now = Date.now();
    const items = ids.map((id, i) => ({ id: now + i, achievement: achievementById(id)! })).filter((x) => x.achievement);
    if (items.length) playSfx('achieve', { volume: settingsRef.current.volume });
    setToasts((p) => [...p, ...items]);
    items.forEach((it) => setTimeout(() => setToasts((p) => p.filter((t) => t.id !== it.id)), 4200));
  };
  /** 実績の判定。プレイ中は画面に出さず、結果画面でまとめて見せる */
  const checkAchievements = (run: Partial<RunStats> | null, quiet: boolean) => {
    const newly = evaluate(run, lifeRef.current, countSeen(seenEnds()), TOTAL_ENDINGS, unlockedRef.current);
    if (!newly.length) return newly;
    const now = Date.now();
    const next = { ...unlockedRef.current };
    newly.forEach((id) => { next[id] = now; });
    unlockedRef.current = next;
    saveUnlocked(next);
    setUnlocked(next);
    if (!quiet) pushToasts(newly);
    return newly;
  };
  const seenEnds = () => loadSeenEndings();
  const bumpLife = (p: Partial<LifetimeStats>) => { lifeRef.current = { ...lifeRef.current, ...p }; saveLifetime(lifeRef.current); };

  const difficulty: Difficulty = settings.difficulty || 'normal';
  const loadScores = useCallback((m: GameMode, d: Difficulty) => {
    try { setHighScores(JSON.parse(localStorage.getItem(LS_KEYS.scores(m, d)) || '[]')); } catch { setHighScores([]); }
  }, []);
  useEffect(() => { loadScores(mode, difficulty); }, [mode, difficulty, loadScores]);

  // マイクの設定を反映
  useEffect(() => { micRef.current.threshold = settings.threshold; }, [settings.threshold]);

  const refreshDevices = useCallback(async () => {
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')); } catch { /* noop */ }
  }, []);
  useEffect(() => {
    if (TAP_ONLY || !navigator.mediaDevices) return;
    refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  const ensureMic = async () => {
    if (TAP_ONLY) return false;
    if (micOn) return true;
    try {
      await micRef.current.start(settingsRef.current.deviceId || undefined);
      setMicOn(true);
      refreshDevices();
      return true;
    } catch {
      setError('マイクが使えませんでした（ブラウザでマイクを許可してください）。キーボード・タップに戻しました。');
      setSettings({ input: 'tap' });
      return false;
    }
  };
  const stopMic = () => { micRef.current.stop(); setMicOn(false); setMicTesting(false); };
  /** あそびかたの切り替え。声にしたら、その場でマイクが使えるか確かめる（使えなければキーボードに戻す） */
  const chooseInput = async (m: 'mic' | 'tap'): Promise<boolean> => {
    setError(null);
    if (m === 'tap') { stopMic(); setSettings({ input: 'tap' }); return true; }
    setSettings({ input: 'mic' });
    return ensureMic();
  };

  // メニュー BGM
  // してみた動画（MV のミニゲーム）は読みこみが重いので、タイトル・あそびかたの画面で手があいているうちに読んでおく
  useEffect(() => {
    if ((gameState !== 'READY' && gameState !== 'RULES') || settings.arcade === false) return;
    const id = window.setTimeout(() => { const ric = (window as any).requestIdleCallback; if (ric) ric(() => loadRH(), { timeout: 3000 }); else loadRH(); }, 2500);
    return () => window.clearTimeout(id);
  }, [gameState, settings.arcade]);

  useEffect(() => {
    const el = menuBgmRef.current;
    if (!el) return;
    el.volume = settings.volume * 0.8;
    if (gameState === 'READY') {
      const play = () => { el.play().catch(() => {}); };
      el.play().catch(() => {
        window.addEventListener('pointerdown', play, { once: true });
        window.addEventListener('keydown', play, { once: true });
      });
      return () => { window.removeEventListener('pointerdown', play); window.removeEventListener('keydown', play); };
    }
    el.pause();
    if (gameState === 'PLAYING') el.currentTime = 0;
  }, [gameState, settings.volume, settings.menuBgm]);

  /* ---------------- 演出ヘルパー ---------------- */
  const showJudge = (text: string, cls: string) => setJudge({ id: performance.now(), text, cls });
  useEffect(() => {
    if (!judge) return;
    const id = judge.id;
    const t = setTimeout(() => setJudge((j) => (j && j.id === id ? null : j)), 520);
    return () => clearTimeout(t);
  }, [judge]);
  const doShake = (cls: string, ms: number) => { setShake(cls); setTimeout(() => setShake(''), ms); };
  const flashMood = (m: ShiashiaMood, ms: number) => { setTempMood(m); setTimeout(() => setTempMood((x) => (x === m ? null : x)), ms); };

  /** タイトルの虹色の「な」を割った：通知が鳴りやまない演出のあと、「運良くバズったエンド」へ */
  const startLucky = () => {
    if (luckyRef.current) return;
    luckyRef.current = true;
    setLuckyFx(true);
    se('special', { gain: 0.9 });
    [0.25, 0.45, 0.62, 0.77, 0.9, 1.0, 1.1].forEach((d, i) => se('ui_toggle', { gain: 0.5, rate: 1.1 + i * 0.05, delay: d }));
    setTimeout(() => {
      const e = endingById('lucky');
      const seen = loadSeenEndings();
      const isNew = !seen[e.id];
      const nextSeen = { ...seen, [e.id]: seen[e.id] || Date.now() };
      saveSeenEndings(nextSeen);
      setSeenEndings(nextSeen);
      checkAchievements(null, false);
      setLuckyFx(false);
      setEnding(e);
      setEndingIsNew(isNew);
      setGameState('ENDING');
    }, 1700);
  };

  /** タイトルの「な」の風船を割ったとき：初期の激しい「な」アニメのどれかを、割れた所から出す */
  const spawnBalloonNa = (x: number, y: number, gold: boolean) => {
    if (perf.lite && Math.random() < 0.5) return;
    const WILD: [NaVariant, Rarity][] = [
      ['pop', 'normal'], ['spin', 'normal'], ['bounce', 'normal'], ['zigzag', 'normal'], ['wave', 'normal'], ['slide', 'normal'],
      ['rainbow', 'uncommon'], ['giant', 'uncommon'], ['swarm', 'uncommon'], ['ring', 'uncommon'], ['shadow', 'uncommon'], ['neon', 'uncommon'],
      ['chain', 'rare'], ['thunder', 'rare'], ['flip', 'rare'], ['blackhole', 'rare'], ['pixel', 'rare'],
      ['tsunami', 'ultra'], ['chaos', 'ultra'], ['matrix', 'ultra'],
    ];
    // 金の「な」はレア以上
    const pool = gold ? WILD.filter(([, r]) => r === 'rare' || r === 'ultra') : WILD;
    const [v, r] = pool[Math.floor(Math.random() * pool.length)];
    const ps = createParticles(v, r);
    const px = `${(x / Math.max(1, window.innerWidth)) * 100}%`, py = `${(y / Math.max(1, window.innerHeight)) * 100}%`;
    // その場で起きるアニメは、割れた所から
    if (['pop', 'spin', 'neon', 'flip', 'thunder', 'pixel', 'ring', 'rainbow', 'bounce'].includes(v)) ps.forEach((p) => { p.left = px; p.top = py; });
    if (v === 'giant') ps.forEach((p) => { p.left = px; });
    setParticles((prev) => [...prev, ...ps].slice(isMobileRef.current ? -45 : -80));
  };
  const spawnBackgroundNa = () => {
    if (perf.lite) return;
    const ps = createParticles(pickVariant(rollRarity(flagsRef.current.buzz)), 'normal');
    if (flagsRef.current.nu) ps.forEach((p) => { p.text = p.text.replace(/な/g, 'ぬ'); });
    setParticles((prev) => [...prev, ...ps].slice(isMobileRef.current ? -45 : -70));
  };
  /** 画面チェンジの瞬間：「な」が降ってきたり、横切ったり、まとめてドバッと出す */
  const spawnSwitchBurst = () => {
    if (perf.lite) return;
    const kinds: [Parameters<typeof createParticles>[0], Parameters<typeof createParticles>[1]][] = [
      ['swarm', 'uncommon'], ['fall', 'normal'], ['fall', 'normal'], ['wave', 'normal'], ['slide', 'normal'], ['zigzag', 'normal'],
    ];
    if (Math.random() < 0.35) kinds.push(['chain', 'rare']);
    const ps = kinds.flatMap(([v, r]) => createParticles(v, r));
    if (flagsRef.current.nu) ps.forEach((p) => { p.text = p.text.replace(/な/g, 'ぬ'); });
    setParticles((prev) => [...prev, ...ps].slice(isMobileRef.current ? -45 : -80));
  };
  useEffect(() => {
    const iv = setInterval(() => setParticles((prev) => {
      const now = Date.now();
      const f = prev.filter((p) => now - Math.floor(p.id / 100) < p.life + 1500);
      return f.length !== prev.length ? f : prev;
    }), 600);
    return () => clearInterval(iv);
  }, []);

  /* ---------------- カットイン ---------------- */
  const playNextCut = () => {
    if (cutCurRef.current || !cutQueueRef.current.length) return;
    // 画面チェンジの案内（切り替えの 2.3 秒前〜2.7 秒後）とかぶるカットインは、案内が終わるまで待つ
    const head = cutQueueRef.current[0];
    if (head.event !== 'burn' && head.event !== 'ban' && gameStateRef.current === 'PLAYING') {
      const tNow = playerRef.current?.time() ?? 0;
      const end = tNow + head.durationMs / 1000;
      const sw = scheduleRef.current.slice(1).find((g) => end > g.t - 2.3 && tNow < g.t + 2.7);
      if (sw) { cutTimerRef.current = window.setTimeout(playNextCut, Math.max(200, (sw.t + 2.7 - tNow) * 1000)); return; }
    }
    const d = cutQueueRef.current.shift()!;
    cutCurRef.current = d;
    setCutIn(d);
    cutTimerRef.current = window.setTimeout(() => {
      cutCurRef.current = null;
      setCutIn(null);
      cutTimerRef.current = window.setTimeout(playNextCut, 280);
    }, d.durationMs);
  };
  const queueCut = (d: Omit<CutInData, 'id'>, urgent = false) => {
    const data = { ...d, id: performance.now() + Math.random() };
    if (urgent) {
      if (cutTimerRef.current) clearTimeout(cutTimerRef.current);
      if (cutCurRef.current && cutCurRef.current.event !== 'burn' && cutCurRef.current.event !== 'ban') cutQueueRef.current.unshift(cutCurRef.current);
      cutCurRef.current = null;
      cutQueueRef.current.unshift(data);
    } else {
      cutQueueRef.current.push(data);
    }
    playNextCut();
  };
  const clearCuts = () => {
    if (cutTimerRef.current) clearTimeout(cutTimerRef.current);
    cutQueueRef.current = []; cutCurRef.current = null; setCutIn(null);
  };

  /* ---------------- 視聴者・登録者 ---------------- */
  const setViewersV = (v: number) => {
    viewersRef.current = Math.max(0, Math.min(100, v));
    setViewers(Math.round(viewersRef.current));
  };
  const addSubs = (n: number) => {
    subsRef.current = Math.max(0, subsRef.current + n);
    if (subsRef.current > peakSubsRef.current) peakSubsRef.current = subsRef.current;
    setSubs(subsRef.current);
    // 節目のカットイン
    while (milestoneIdxRef.current < MILESTONES.length && subsRef.current >= MILESTONES[milestoneIdxRef.current].subs) {
      const m = MILESTONES[milestoneIdxRef.current++];
      queueCut({ event: m.event, title: m.title, sub: m.sub, shield: m.shield, quota: m.subs === QUOTA[runRef.current.mode], durationMs: 2900 });
      playJingle(playerRef.current?.ctx ?? null, m.subs === QUOTA[runRef.current.mode] ? 'clear' : 'milestone', settingsRef.current.volume);
    }
  };
  const startBuzz = (t: number) => {
    buzzUntilRef.current = t + BUZZ_EIGHTHS * EIGHTH;
    flagsRef.current.buzz = true;
    setBuzz(true);
    runRef.current.buzzes++;
    setViewersV(VIEWERS.buzzReset);
    showJudge('バズった！ 登録者2倍', 'text-amber-500');
    if (se('buzz', { gain: 0.8 })) { se('coins', { delay: 0.25 }); se('coins', { delay: 0.45, rate: 1.2 }); }
    else playJingle(playerRef.current?.ctx ?? null, 'milestone', settingsRef.current.volume);
  };
  const checkViewers = (t: number) => {
    if (viewersRef.current >= 100 && !flagsRef.current.buzz) startBuzz(t);
    if (viewersRef.current <= 0) finishGame('cutoff');
  };

  /* ---------------- 入力 ---------------- */
  /**
   * 判定に使うタイミング補正（秒）。タイミング合わせをしていなければ、音が出るまでの遅れ＋押してから届くまでの目安を使う
   */
  const effOffset = (src: 'mic' | 'tap') => {
    const v = offsetsRef.current[src];
    if (v != null) return v;
    return (playerRef.current?.outLatency() ?? 0) + (src === 'mic' ? 0.07 : 0.03);
  };
  /** 1 プレイのズレ（押した時刻 − 音符の時刻）。結果画面で「早い／遅い」と補正のおすすめを出す */
  const dtsRef = useRef<number[]>([]);

  /** 強弱のボーナス（合っていたら登録者を上乗せ） */
  const curMul = () => {
    const fx = effectsRef.current;
    return (flagsRef.current.buzz ? 2 : 1) * (fx.some((x) => x.id === 'superchat') ? 3 : 1) * (flagsRef.current.nu ? 0.7 : 1) * chartRef.current.gainMul;
  };
  const judgePower = (n: NoteState, ok: boolean) => {
    if (n.powerOk !== undefined || !n.power) return;
    n.powerOk = ok;
    const run = runRef.current;
    run.powerTotal++;
    if (ok) {
      run.powerOk++;
      addSubs(gainFor(n.t, 'perfect', comboRef.current, viewersRef.current, curMul(), chartRef.current.comboFull) * (n.power === 'big' ? 1 : 0.5));
      showJudge(n.power === 'big' ? (settingsRef.current.input === 'mic' ? '大声ナイス！' : '同時押しナイス！') : 'ささやきナイス！', n.power === 'big' ? 'text-orange-500' : 'text-violet-500');
      if (n.power === 'big') { doShake('shake', 250); se('hit_big', { gain: 0.9 }, true); }
    } else {
      showJudge(n.power === 'big' ? (settingsRef.current.input === 'mic' ? 'もっと大きく！' : '2つ同時に！') : 'もっと小さく！', 'text-slate-500');
    }
  };
  /** 声の大きさを、その人のふつうの声とくらべる */
  const voiceLevel = (peak: number): 'small' | 'normal' | 'big' => {
    const arr = voicePeaksRef.current;
    const thr = micRef.current.threshold;
    let lv: 'small' | 'normal' | 'big';
    if (arr.length < 5) lv = peak > thr + 35 ? 'big' : peak < thr + 10 ? 'small' : 'normal';
    else {
      const med = [...arr].sort((a, b) => a - b)[arr.length >> 1];
      lv = peak >= Math.max(med * 1.3, med + 10) ? 'big' : peak <= Math.min(med * 0.72, med - 8) ? 'small' : 'normal';
    }
    arr.push(peak); if (arr.length > 15) arr.shift();
    return lv;
  };

  const segsStyleAt = (tt: number) => { const sg = scheduleRef.current; return sg[segIndexAt(sg, tt)].style; };
  const hitPosRef = useRef<((n: NoteState) => { x: number; y: number; r: number } | null) | null>(null);
  const handleInput = (src: 'mic' | 'tap', pos?: { x: number; y: number }) => {
    if (gameStateRef.current !== 'PLAYING' || finishingRef.current) return;
    const p = playerRef.current, e = engineRef.current;
    if (!p || !e) return;
    // 押した瞬間の手ごたえ（キーボード・タップのとき。当たっても外れても鳴らす）
    if (src === 'tap' && settingsRef.current.hitSound !== false) { const pc = p.ctx; playTap({ volume: settingsRef.current.volume, ctx: pc && pc.state === 'running' ? pc : null, pitch: 0.95 + Math.random() * 0.1 }); }
    // 伸ばし中は、ほかの入力を数えない（空振りにしない）
    if (activeHoldRef.current) return;
    // 大きい「な」の 2 つ目のキー（同時押し）・2 本目の指
    const lh = lastHitRef.current;
    if (src === 'tap' && lh && lh.note.power === 'big' && lh.note.powerOk === undefined && performance.now() - lh.at < 90) {
      judgePower(lh.note, true);
      return;
    }
    const t = p.time();
    if (t < chartRef.current.firstT - 0.6) return;     // カウント中は数えない
    const off = effOffset(src);
    const tc = t - off * p.getRate();
    // 通常モード（タップ・クリック）：ノーツの場所を押したときだけ当たり。キーボードは場所がないので、どこでもよい
    const posCheck = src === 'tap' && pos && settingsRef.current.tapMode === 'normal' && hitPosRef.current;
    const r = e.input(tc, posCheck ? (n) => { const hp = hitPosRef.current?.(n); return !hp || Math.hypot(hp.x - pos!.x, hp.y - pos!.y) <= hp.r; } : undefined);
    if (r.type === 'wrongSpot') { showJudge('そこじゃない', 'text-slate-400'); return; }
    const run = runRef.current;
    if (r.type === 'hit') {
      const j: Judge = r.judge;
      comboRef.current++;
      setCombo(comboRef.current);
      run.hits++; run[j]++;
      if (comboRef.current > run.maxCombo) run.maxCombo = comboRef.current;
      const fx = effectsRef.current;
      const mul = (flagsRef.current.buzz ? 2 : 1) * (fx.some((x) => x.id === 'superchat') ? 3 : 1) * (flagsRef.current.nu ? 0.7 : 1);
      const ch = chartRef.current;
      addSubs(gainFor(r.note.t, j, comboRef.current, viewersRef.current, mul * ch.gainMul, ch.comboFull));
      // バズ中は視聴者が増えない（バズを連発しないように）
      if (!flagsRef.current.buzz) setViewersV(viewersRef.current + VIEWERS.hit[j] * ch.viewerMul);
      // 伸ばし・強弱
      const n = r.note;
      dtsRef.current.push(r.dt);
      lastHitRef.current = { note: n, at: performance.now(), src };
      if (n.kind === 'hold') { n.hold = 'on'; activeHoldRef.current = n; holdGapRef.current = null; }
      if (src === 'mic') {
        // 声の大きさは、声が出てから少しのあいだのいちばん大きい所で決める
        setTimeout(() => { const lv = voiceLevel(micRef.current.peakSinceOnset); if (n.power) judgePower(n, lv === n.power); }, 75);
      } else if (n.power === 'small') {
        n.powerOk = true;                      // キーボード・タップは小さい「な」の指定なし
      } else if (n.power === 'big') {
        setTimeout(() => { if (n.powerOk === undefined) judgePower(n, false); }, 100);
      }
      hitRef.current = performance.now();
      flagsRef.current.lastHit = hitRef.current;
      showJudge(j === 'perfect' ? 'PERFECT' : j === 'great' ? 'GREAT' : 'GOOD', j === 'perfect' ? 'text-amber-400' : j === 'great' ? 'text-pink-500' : 'text-sky-500');
      // タップ音（キーボード・タップのときだけ）とコンボの声
      // してみた動画：打ったら、きあきあのお手本と同じ音（まねできた！が耳で分かる）
      if (segsStyleAt(n.t) === 'heaven') {
        // 早めに押したときは、その拍ぴったりに鳴らす（お手本と同じ所で鳴るので、まねできたのが耳で分かる）
        const sx = HEAVEN_SFX[heavenGameAt(scheduleRef.current, n.t).game], pl = playerRef.current, when = pl?.ctxTimeOf(n.t);
        if (!(TAP_ONLY || settingsRef.current.input === 'tap')) { /* 声で遊ぶときはマイクが拾うので鳴らさない */ }
        else if (pl && when != null) playSfxAt(sx.id, Math.max(pl.ctx.currentTime, when), { ctx: pl.ctx, volume: settingsRef.current.volume, rate: sx.rate, gain: 0.95, onBeat: true });
        else se(sx.id, { rate: sx.rate, gain: 0.95 }, true);
      }
      if (src === 'tap' && settingsRef.current.hitSound !== false) se('hit', { rate: j === 'perfect' ? 1.12 : j === 'great' ? 1 : 0.88, gain: n.vel ? Math.min(1.3, n.vel) : 1 }, true);
      // コンボの声（「コンボ！」）は、プレイの途中で耳に残って気になるので鳴らさない（文字の COMBO だけ）
      if (Math.random() < 0.18 + chaos * 0.6) spawnBackgroundNa();
      checkViewers(t);
    } else if (r.type === 'extra') {
      comboRef.current = 0; setCombo(0);
      run.extras++;
      setViewersV(viewersRef.current + VIEWERS.extra);
      showJudge('空振り', 'text-slate-400');
      checkViewers(t);
    } else if (r.type === 'burnHit') {
      // 炎上チャレンジの合図に合わせられた
      const pat = r.burn.plan?.pattern;
      showJudge(pat === 'apology' ? 'ペコリ！' : pat === 'delete' ? '削除！' : pat === 'dodge' ? 'よけた！' : 'ごめん！', 'text-orange-500');
      se(pat === 'dodge' ? 'poke_jump' : pat === 'delete' ? 'ui_close' : 'hit_big', { gain: 0.8 }, true);
      setViewersV(viewersRef.current + 2);
      hitRef.current = performance.now();
    } else if (r.type === 'burnMash') {
      se('pop', { rate: 1.4 + Math.random() * 0.4, gain: 0.45 }, true);
      hitRef.current = performance.now();
      const pl = r.burn.plan; if (pl && pl.mash === pl.mashTarget) { showJudge('消えた！', 'text-sky-500'); se('fix', {}, true); }
    } else if (r.type === 'burnJump') {
      se('poke_jump', { gain: 0.5 }, true);
    } else if (r.type === 'burnHold') {
      holdGapBurnRef.current = null;
    } else if (r.type === 'fuel') {
      onFuel(r.burn.id, r.first, t);
    }
  };
  /** 火に油：登録者・視聴者が減る。その炎上で初めてなら警告 1 つ（3 つで BAN）。大炎上の演出 */
  const onFuel = (burnId: number, first: boolean, t: number) => {
    const run = runRef.current;
    {
      comboRef.current = 0; setCombo(0);
      addSubs(-subsRef.current * FUEL_LOSS);
      setViewersV(viewersRef.current + VIEWERS.fuel);
      hitRef.current = performance.now();
      showJudge('火に油', 'text-red-500');
      doShake('shake', 350);
      flashMood('shock', 700);
      playJingle(playerRef.current?.ctx ?? null, 'buzz', settingsRef.current.volume);
      if (!burnFxShownRef.current.has(burnId)) { burnFxShownRef.current.add(burnId); setBurnFx({ id: performance.now(), kind: 'fail' }); se('fire', { gain: 0.9 }); se('boom_low', { gain: 0.5, rate: 1.4 }); }
      if (first) {
        run.fuels++;
        strikesRef.current++;
        setStrikes(strikesRef.current);
        if (strikesRef.current >= BAN_STRIKES) { finishGame('ban'); return; }
      }
      checkViewers(t);
    }
  };
  const handleInputRef = useRef(handleInput);
  handleInputRef.current = handleInput;

  useEffect(() => {
    micRef.current.onOnset = () => handleInputRef.current('mic');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'PLAYING') {
        if (e.code === 'Escape') { e.preventDefault(); pauseGame(); return; }
        if (e.repeat) return;
        if (PLAY_KEYS.has(e.code)) keysDownRef.current.add(e.code);
        if (PLAY_KEYS.has(e.code) && (TAP_ONLY || settingsRef.current.input === 'tap')) {
          e.preventDefault(); handleInputRef.current('tap');
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysDownRef.current.delete(e.code); };
    const onPtrUp = (e: PointerEvent) => { pointersDownRef.current.delete(e.pointerId); };
    const clearAll = () => { keysDownRef.current.clear(); pointersDownRef.current.clear(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onPtrUp);
    window.addEventListener('pointercancel', onPtrUp);
    window.addEventListener('blur', clearAll);
    return () => {
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onPtrUp); window.removeEventListener('pointercancel', onPtrUp); window.removeEventListener('blur', clearAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- special「な」 ---------------- */
  const takeItem = (id: number, ev: React.PointerEvent) => {
    ev.stopPropagation();
    setSpecials((s) => s.filter((x) => x.id !== id));
    const p = playerRef.current;
    if (!p || gameStateRef.current !== 'PLAYING') return;
    const def = rollItem();
    const run = runRef.current;
    run.items++;
    if (!lifeRef.current.itemsSeen.includes(def.id)) bumpLife({ itemsSeen: [...lifeRef.current.itemsSeen, def.id] });
    playJingle(p.ctx, 'item', settingsRef.current.volume);
    const now = performance.now();
    const until = now + def.seconds * 1000;
    switch (def.id) {
      case 'plus1000': addSubs(1000); break;
      case 'osusume': if (!flagsRef.current.buzz) startBuzz(p.time()); break;
      case 'kirinuki': setViewersV(viewersRef.current + 30); checkViewers(p.time()); break;
      case 'bpmUp': p.setRate(1.2); break;
      case 'bpmDown': p.setRate(0.8); break;
      case 'godMic': if (engineRef.current) engineRef.current.winMul = 1.6; break;
      case 'mirror': flagsRef.current.mirror = true; break;
      case 'nu': flagsRef.current.nu = true; break;
      case 'thumbnail': flagsRef.current.hidden = true; break;
      default: break;
    }
    if (def.seconds > 0) {
      // 同じ種類が出たら延長、BPM は後から出た方が勝つ
      effectsRef.current = effectsRef.current.filter((x) => x.id !== def.id && !((def.id === 'bpmUp' || def.id === 'bpmDown') && (x.id === 'bpmUp' || x.id === 'bpmDown')));
      effectsRef.current.push({ id: def.id, until });
      setActiveFx(effectsRef.current.map((x) => x.id));
    }
    setItemCard({ id: now, def, until: def.seconds > 0 ? until : now + 1800, total: def.seconds > 0 ? def.seconds * 1000 : 1800 });
  };
  const endEffect = (id: ItemId) => {
    const p = playerRef.current;
    switch (id) {
      case 'bpmUp': case 'bpmDown': p?.setRate(1); break;
      case 'godMic': if (engineRef.current) engineRef.current.winMul = 1; break;
      case 'mirror': flagsRef.current.mirror = false; break;
      case 'nu': flagsRef.current.nu = false; break;
      case 'thumbnail': flagsRef.current.hidden = false; break;
      default: break;
    }
  };

  /* ---------------- 流れ ---------------- */
  const prepareSong = () => {
    if (!playerRef.current) playerRef.current = new SongPlayer();
    const p = playerRef.current;
    p.ctx.resume().catch(() => {});
    setSongReady(false);
    p.load(bgmUrl).then(() => setSongReady(true)).catch(() => { setError('曲の読み込みに失敗しました。'); setSongReady(false); });
  };

  const handleStart = async () => {
    setError(null);
    prepareSong();
    if (input === 'mic') { const ok = await ensureMic(); if (!ok) return; }
    setMicTesting(false);
    if (offsetsRef.current[input] == null) setGameState('CALIBRATE');
    else setGameState('RULES');
  };

  const startPlay = async () => {
    const p = playerRef.current;
    if (!p) return;
    const ch = buildChart(mode, settingsRef.current.difficulty || 'normal');
    chartRef.current = ch;
    // 10 秒は入門なので画面チェンジなし
    scheduleRef.current = buildStyleSchedule(ch.endT, settingsRef.current.arcade !== false && mode !== '10s');
    const forcedStyle = (window as any).__forceStyle as TrackStyle | undefined;      // テスト用：画面を固定
    if (forcedStyle) scheduleRef.current = [{ t: -1e9, style: forcedStyle }];
    // してみた動画：1 小節目はきあきあのお手本、2 小節目にあなたがまねする（音符を並べかえる）
    ch.notes = heavenCallResponse(ch.notes, scheduleRef.current, (tt) => ch.burns.some((b) => tt > b.t0 - 0.3 && tt < b.t1 + 1.1));
    heavenCueRef.current = new Set();
    segDirtyRef.current = new Set(); lastSegRef.current = 0;
    activeHoldRef.current = null; holdGapRef.current = null; lastHitRef.current = null; keysDownRef.current.clear(); pointersDownRef.current.clear();
    dtsRef.current = [];
    setTrackStyle('lane'); setStyleBanner(null); styleBannerIdRef.current = -1;
    const eng = new JudgeEngine(ch.notes, ch.burns);
    // 炎上チャレンジ：炎上ごとにパターンを決める（声で遊ぶときはいつも「黙れ」）
    const forcedBurn = (window as any).__forceBurn as BurnPattern | undefined;      // テスト用：炎上のパターンを固定
    const pats = forcedBurn ? eng.burns.map(() => forcedBurn) : pickBurnPatterns(eng.burns.length, !TAP_ONLY && settingsRef.current.input === 'mic');
    eng.burns.forEach((b, k) => { b.plan = planBurn(b.start, b.end, b.t0, b.t1, pats[k]); });
    burnFxShownRef.current = new Set(); holdGapBurnRef.current = null; setBurnFx(null);
    engineRef.current = eng;
    notesRef.current = eng.notes;
    burnsRef.current = eng.burns;
    if ((window as any).__forceBurn) { (window as any).__engBurns = eng.burns; (window as any).__engNotes = eng.notes; (window as any).__hitPosRef = hitPosRef; (window as any).__songTime = () => playerRef.current?.audibleTime() ?? 0; }
    runRef.current = emptyRun(mode, ch.difficulty, ch.notes.length);
    runRef.current.input = TAP_ONLY ? 'tap' : settingsRef.current.input;
    runRef.current.holdsTotal = ch.notes.filter((n) => n.kind === 'hold').length;
    flagsRef.current = { mirror: false, hidden: false, nu: false, buzz: false, lastHit: 0, lastJudge: '' };
    subsRef.current = 0; peakSubsRef.current = 0; comboRef.current = 0; strikesRef.current = 0;
    buzzUntilRef.current = -1; effectsRef.current = []; milestoneIdxRef.current = 0;
    nextSpecialRef.current = 6.5 + Math.random() * 2;
    announcedRef.current = new Set(); finishingRef.current = false; runUnlockedRef.current = [];
    setSubs(0); setCombo(0); setViewersV(VIEWERS.start); setStrikes(0); setBuzz(false); setActiveFx([]); setItemCard(null);
    setSpecials([]); setParticles([]); setEnding(null); setTempMood(null); setBanFlash(false); setTimePct(1); setCommentMood('normal');
    clearCuts();
    try {
      const prev: ScoreEntry[] = JSON.parse(localStorage.getItem(LS_KEYS.scores(mode, ch.difficulty)) || '[]');
      prevBestRef.current = prev.length ? Math.max(...prev.map((e) => e.score)) : 0;
    } catch { prevBestRef.current = 0; }
    p.setVolume(settingsRef.current.volume);
    p.clicks = settingsRef.current.clicks;
    p.stop();
    await p.start(0);
    // カウントダウンの声「3・2・1」を、曲の拍ぴったりに予約する（声で遊ぶときはマイクが拾うので鳴らさない）
    cancelPendingSfx();
    if (voiceOn() && (TAP_ONLY || settingsRef.current.input === 'tap')) {
      // 4 拍子 2 小節ぶん：1 小節目は「3（1 拍目）・2（3 拍目）」、2 小節目は「3・2・1・GO」を 1 拍ずつ。そのあとの小節の頭が最初の「な」
      // 声の「聞こえる拍の位置」は音の頭ではなく母音の立ち上がりなので、声ごとに測った分だけ早めに鳴らす（sfx.ts の ONSET）
      COUNT_IN.forEach(([id, beats]) => {
        const when = p.ctxTimeOf(ch.firstT - BEAT * beats);
        if (when != null) playSfxAt(id, when, { ctx: p.ctx, volume: settingsRef.current.volume, onBeat: true });
      });
    }
    setGameState('PLAYING');
  };

  // 説明を出さない設定なら、曲が読み込めたらすぐ始める
  useEffect(() => {
    if (gameState === 'RULES' && skipRules && songReady) startPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, skipRules, songReady]);

  const pauseGame = async () => {
    if (gameStateRef.current !== 'PLAYING') return;
    pauseAtRef.current = performance.now();
    runRef.current.pauses++;
    setGameState('PAUSED');
    await playerRef.current?.pause();
  };
  const resumeGame = async () => {
    const d = performance.now() - pauseAtRef.current;
    effectsRef.current.forEach((x) => { x.until += d; });
    setItemCard((c) => (c ? { ...c, until: c.until + d } : c));
    await playerRef.current?.resume();
    setGameState('PLAYING');
  };
  useEffect(() => {
    const onVis = () => { if (document.hidden) pauseGame(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quitToTitle = () => {
    finishingRef.current = true;
    cancelPendingSfx();
    playerRef.current?.stop();
    playerRef.current?.resume();
    clearCuts();
    if (input === 'mic') stopMic();
    setGameState('READY');
  };

  const finishGame = (reason: 'done' | 'cutoff' | 'ban') => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const run = runRef.current;
    run.subs = Math.floor(subsRef.current);
    run.cutoff = reason === 'cutoff';
    run.ban = reason === 'ban';
    run.burnsTotal = burnsRef.current.filter((b) => b.ended).length;
    run.cleared = reason === 'done' && run.subs >= run.quota;
    run.finished = true;
    // 画面チェンジ：見た種類と、ノーミスで乗り切った区間の数
    {
      const segs = scheduleRef.current;
      const tEnd = reason === 'done' ? Infinity : (playerRef.current?.time() ?? 0);
      const endT = chartRef.current?.endT ?? 0;
      const seen = new Set<TrackStyle>();
      let clean = 0;
      for (let i = 1; i < segs.length; i++) {
        if (segs[i].t > tEnd) break;
        seen.add(segs[i].style);
        const segEnd = segs[i + 1]?.t ?? endT;
        if (segEnd <= tEnd && !segDirtyRef.current.has(i)) clean++;
      }
      run.stylesSeen = seen.size;
      run.styleClean = clean;
    }

    const go = () => {
      playerRef.current?.stop();
      if (input === 'mic') stopMic();
      clearCuts();
      // エンディング
      const e = pickEnding(run);
      const seen = loadSeenEndings();
      const isNew = !seen[e.id];
      const nextSeen = { ...seen, [e.id]: seen[e.id] || Date.now() };
      saveSeenEndings(nextSeen);
      setSeenEndings(nextSeen);
      // 記録
      bumpLife({ plays: lifeRef.current.plays + 1, totalHits: lifeRef.current.totalHits + run.hits });
      const key = LS_KEYS.scores(run.mode, run.difficulty);
      let scores: ScoreEntry[] = [];
      try { scores = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* noop */ }
      isNewRecordRef.current = run.subs > prevBestRef.current && run.subs > 0;
      scores.push({ score: run.subs, hitCount: run.hits, date: Date.now(), endingId: e.id });
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 5);
      saveJSON(key, scores);
      setHighScores(scores);
      runUnlockedRef.current = checkAchievements({ ...run, subs: Math.max(run.subs, Math.floor(peakSubsRef.current)) }, true);
      setEnding(e);
      setEndingIsNew(isNew);
      setGameState('ENDING');
    };

    if (reason === 'ban') {
      setBanFlash(true);
      queueCut({ event: 'ban', title: 'BANをくらった', sub: '警告 3/3　チャンネル削除', durationMs: 2600 }, true);
      playJingle(playerRef.current?.ctx ?? null, 'ban', settingsRef.current.volume);
      playerRef.current?.setRate(0.6);
      setTimeout(go, 2700);
    } else if (reason === 'cutoff') {
      flashMood('sad', 2000);
      showJudge('視聴者 0人', 'text-slate-500');
      playJingle(playerRef.current?.ctx ?? null, 'fail', settingsRef.current.volume);
      setTimeout(go, 1300);
    } else {
      setTimeout(go, 400);
    }
  };

  /* ---------------- メインループ ---------------- */
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    let raf = 0;
    let lastUi = 0;
    // 重さの見張り：3 秒間の平均が 1 コマ 28ms（約 35fps）より遅ければ、かるいモードにする
    let fpsT0 = performance.now(), fpsN = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      fpsN++;
      const nowF = performance.now();
      if (nowF - fpsT0 > 3000) {
        if ((nowF - fpsT0) / fpsN > 28 && !perf.lite) setLiteAuto(true);
        fpsT0 = nowF; fpsN = 0;
      }
      const p = playerRef.current, e = engineRef.current;
      if (!p || !e || finishingRef.current) return;
      const t = p.time();
      p.scheduleClicks();
      const off = effOffset(TAP_ONLY ? 'tap' : settingsRef.current.input);
      const tc = t - off * p.getRate();
      const ch = chartRef.current;
      const run = runRef.current;

      // 伸ばし：最後まで声・指・キーが続いたか
      const h = activeHoldRef.current;
      if (h) {
        const st = settingsRef.current;
        const holding = st.input === 'mic' && !TAP_ONLY
          ? micRef.current.level > micRef.current.threshold * 0.75
          : keysDownRef.current.size > 0 || pointersDownRef.current.size > 0;
        const nowP = performance.now();
        if (tc >= (h.t2 ?? h.t)) {
          h.hold = 'ok'; activeHoldRef.current = null;
          run.holdsOk++;
          addSubs(gainFor(h.t2 ?? h.t, 'perfect', comboRef.current, viewersRef.current, curMul(), ch.comboFull) * Math.max(1, ((h.t2 ?? h.t) - h.t) / 0.35) * 0.5);
          showJudge('なーー！ 伸ばし成功', 'text-emerald-500');
          se('hold_ok', { gain: 0.8 }, true);
          hitRef.current = nowP; flagsRef.current.lastHit = nowP;
          spawnBackgroundNa();
        } else if (!holding) {
          if (holdGapRef.current == null) holdGapRef.current = nowP;
          else if (nowP - holdGapRef.current > 170) { h.hold = 'broken'; activeHoldRef.current = null; showJudge('とぎれた…', 'text-slate-400'); }
        } else holdGapRef.current = null;
      }
      for (const ev of e.tick(tc)) {
        if (ev.type === 'miss') {
          comboRef.current = 0; setCombo(0);
          run.misses++;
          segDirtyRef.current.add(segIndexAt(scheduleRef.current, ev.note.t));
          setViewersV(viewersRef.current + VIEWERS.miss);
          showJudge('MISS', 'text-slate-400');
          // してみた動画：失敗の音（ゲームごと）＋がっかりの音
          if (segsStyleAt(ev.note.t) === 'heaven') { const fx = HEAVEN_FAIL_SFX[heavenGameAt(scheduleRef.current, ev.note.t).game]; se(fx.id, { rate: fx.rate, gain: 0.9 }, true); se('down', { gain: 0.55, rate: 1.1, delay: 0.12 }, true); }
          checkViewers(t);
          if (finishingRef.current) return;
        } else if (ev.type === 'burnMiss') {
          setViewersV(viewersRef.current - 3);
          showJudge('おそい…', 'text-slate-400');
        } else if (ev.type === 'burnEnd') {
          const plan = ev.burn.plan;
          const res = plan ? judgeBurn(plan, ev.burn.fueled) : ev.burn.fueled ? 'fail' : 'ok';
          if (plan) plan.result = res;
          if (res === 'ok') {
            run.burnsKept++;
            setViewersV(viewersRef.current + VIEWERS.calmed);
            showJudge('鎮火', 'text-emerald-500');
            setBurnFx({ id: performance.now(), kind: 'ok' });
            se('fix', { gain: 0.9 }); se('item', { delay: 0.15, gain: 0.6 });
            checkViewers(t);
          } else if (!ev.burn.fueled) {
            // 合図をのがした・消しきれなかった：終わったところで火に油
            ev.burn.fueled = true;
            onFuel(ev.burn.id, true, t);
            if (finishingRef.current) return;
          }
        }
      }

      // 炎上の予告カットイン：やること（パターン）を見せる。炎上が始まるころには引っこめて、画面の合図を見せる
      for (const b of e.burns) {
        if (!announcedRef.current.has(b.id) && t >= b.t0 - 1.5) {
          announcedRef.current.add(b.id);
          const info = BURN_INFO[b.plan?.pattern ?? 'silent'];
          const silent = !b.plan || b.plan.pattern === 'silent';
          queueCut({ event: 'burn', title: silent ? '炎上した！' : `炎上！${info.title}`, sub: silent ? '黙れ！ 声を出すと火に油' : info.how, durationMs: silent ? Math.max(1700, ((b.t1 - t) / p.getRate()) * 1000) : 1650 }, true);
          se('fire', { gain: 0.7 }, true);
        }
      }
      // がまん：押しっぱなしでないと火に油
      for (const b of e.burns) {
        if (b.plan?.pattern !== 'hold' || b.fueled || t < b.plan.holdFrom || t > b.t1 - 0.04) continue;
        const holding = keysDownRef.current.size > 0 || pointersDownRef.current.size > 0;
        const nowP = performance.now();
        if (holding) holdGapBurnRef.current = null;
        else if (holdGapBurnRef.current == null) holdGapBurnRef.current = nowP;
        else if (nowP - holdGapBurnRef.current > 220) { const r = e.fuelNow(b); if (r.type === 'fuel') onFuel(b.id, r.first, t); if (finishingRef.current) return; }
      }

      // してみた動画：きあきあのお手本の音を、曲の拍ぴったりに予約する（声で遊ぶときはマイクが拾うので鳴らさない）
      if (TAP_ONLY || settingsRef.current.input === 'tap') {
        for (const sg of scheduleRef.current) {
          if (!sg.demos) continue;
          for (const d of sg.demos) {
            if (d.t < t - 0.05 || d.t > t + 0.35 || heavenCueRef.current.has(d.t)) continue;
            heavenCueRef.current.add(d.t);
            const sx = HEAVEN_SFX[d.game], when = p.ctxTimeOf(d.t);
            if (when != null && !e.burns.some((b) => d.t > b.t0 - 0.2 && d.t < b.t1)) playSfxAt(sx.id, when, { ctx: p.ctx, volume: settingsRef.current.volume, rate: sx.rate * (d.big ? 0.85 : 1), gain: d.big ? 1.2 : 0.95, onBeat: true });
          }
        }
      }

      // バズの終わり
      if (flagsRef.current.buzz && t >= buzzUntilRef.current) { flagsRef.current.buzz = false; setBuzz(false); }

      // アイテム効果の終わり
      const now = performance.now();
      if (effectsRef.current.some((x) => x.until <= now)) {
        effectsRef.current.filter((x) => x.until <= now).forEach((x) => endEffect(x.id));
        effectsRef.current = effectsRef.current.filter((x) => x.until > now);
        setActiveFx(effectsRef.current.map((x) => x.id));
      }

      // special「な」
      if (t >= nextSpecialRef.current && t < ch.endT - 4) {
        nextSpecialRef.current = t + 11 + Math.random() * 7;
        const id = now;
        const dur = 5200;
        // 譜面と重ならないように、譜面の下（せまければ上）を飛ばす
        const A = playAreas(), band = A.bottom.h >= 100 ? A.bottom : A.top;
        const topPx = band.y + 28 + Math.random() * Math.max(0, band.h - 96 - 42);      // 上下に少しゆれて飛ぶぶん（±26px）あける
        setSpecials((s) => [...s, { id, top: (topPx / Math.max(1, vp.h)) * 100, dur }]);
        se('special', { gain: 0.55, rate: 1.1 }, true);
        setTimeout(() => setSpecials((s) => s.filter((x) => x.id !== id)), dur + 100);
      }

      // 画面の更新（重くならないよう 1 秒に 12 回）
      if (now - lastUi > 80) {
        lastUi = now;
        const left = ch.firstT - p.audibleTime();   // 数え始めも、耳に聞こえている曲に合わせる
        const bl = left / BEAT;
        const cd = bl > 8 ? '準備して' : bl > 0 ? COUNT_IN.find(([, b]) => bl <= b + 1e-6 && bl > b - (b > 4 ? 2 : 1))?.[2] ?? null : left > -0.45 ? 'な！' : null;
        setCountdown((c) => (c === cd ? c : cd));
        const pct = Math.max(0, Math.min(1, (ch.endT - t) / (ch.endT - ch.firstT)));
        setTimePct(pct);
        const inBurn = e.burns.some((b) => t >= b.t0 - 0.85 && t <= b.t1);
        const m: CommentMood = inBurn ? 'burn' : flagsRef.current.nu ? 'nu' : flagsRef.current.buzz ? 'hype' : 'normal';
        setCommentMood((x) => (x === m ? x : m));
        // 画面チェンジ：今の見た目と、切り替えのお知らせ
        const segs = scheduleRef.current;
        const k = segIndexAt(segs, t);
        setTrackStyle((x) => (x === segs[k].style ? x : segs[k].style));
        if (k > 0 && lastSegRef.current !== k) {
          spawnSwitchBurst();
          se('mode_switch', { gain: 0.9 });            // 切り替えは休みの所なので、声で遊んでいても鳴らす
          if (k === segs.length - 1 && voiceOn()) se('v_final', { gain: 0.8, delay: 0.15 }, true);
        }
        lastSegRef.current = k;
        const nx = segs[k + 1];
        const bn = nx && nx.t - t < 2.2 ? { id: k + 1, style: nx.style } : k > 0 && t - segs[k].t < 0.9 ? { id: k, style: segs[k].style } : null;
        if (bn && bn.id === k + 1 && styleBannerIdRef.current !== bn.id) se('mode_alert', { gain: 0.8 }, true);
        styleBannerIdRef.current = bn?.id ?? styleBannerIdRef.current;
        setStyleBanner((x) => (x?.id === bn?.id ? x : bn));
      }

      if (t >= ch.endT) finishGame('done');
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // 結果画面の演出タイマー
  useEffect(() => {
    if (gameState !== 'FINISHED') return;
    const t0 = Date.now();
    setRevealT(0);
    const iv = setInterval(() => setRevealT(Date.now() - t0), 40);
    const run = runRef.current;
    const cleared = run.cleared;
    // 結果のジングル → アナウンスの声（クリア：WINNER／ノーミス：FLAWLESS VICTORY／失敗：YOU LOSE・GAME OVER）
    const j1 = setTimeout(() => {
      if (!se(cleared ? 'res_clear' : 'res_fail')) { playJingle(null, cleared ? 'clear' : 'fail', settingsRef.current.volume); return; }
      if (!voiceOn()) return;
      const flawless = cleared && run.misses === 0 && run.extras === 0 && run.fuels === 0;
      se(cleared ? (flawless ? 'v_flawless' : 'v_winner') : run.ban || run.cutoff ? 'v_gameover' : 'v_lose', { delay: 0.95 });
    }, 350);
    const j2 = setTimeout(() => {
      if (!isNewRecordRef.current) return;
      if (!se('res_record')) { playJingle(null, 'record', settingsRef.current.volume); return; }
      if (voiceOn()) se('v_highscore', { delay: 0.7 });
    }, 2600);
    const stop = setTimeout(() => clearInterval(iv), 6000);
    return () => { clearInterval(iv); clearTimeout(j1); clearTimeout(j2); clearTimeout(stop); };
  }, [gameState]);

  /** タイトルのしあしあをつついたときの反応。さわりすぎると、きあきあが出てくる */
  const showReact = (text: string, r: Reaction) => {
    seatedReactRef.current?.(r);
    const POKE: Record<Reaction, [SfxId, number]> = {
      surprise: ['poke_surprise', 1], giggle: ['poke_giggle', 1], shy: ['poke_shy', 1], angry: ['poke_angry', 1], spin: ['poke_spin', 1],
      na: ['pop', 1.3], dizzy: ['poke_spin', 0.7], jump: ['poke_jump', 1], cry: ['poke_cry', 1], fear: ['poke_fear', 0.9],
    };
    const [sid, rate] = POKE[r] ?? ['poke_surprise', 1];
    se(sid, { rate: rate * (0.95 + Math.random() * 0.1) });
    const id = performance.now();
    setReactSay({ id, text });
    setTimeout(() => setReactSay((x) => (x && x.id === id ? null : x)), 1900);
  };
  /** タイトルのしあしあをつまみ上げた・はなした */
  const sayOnly = (text: string, ms = 1600) => {
    const id = performance.now();
    setReactSay({ id, text });
    setTimeout(() => setReactSay((x) => (x && x.id === id ? null : x)), ms);
  };
  const handleTitleGrab = () => {
    if (kiaOn || deathOn) return;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    sayOnly(pick(['わわっ！？', 'たかーい！', 'お、おろして〜', 'ぶらーん', 'つままれた…']), 2200);
    se('poke_surprise', { rate: 1.1 });
    se('swing', { gain: 0.6, rate: 1.2 });
  };
  const handleTitleDrop = () => {
    if (kiaOn || deathOn) return;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    sayOnly(pick(['ぽてっ', 'いたた…', 'ちゃくち！', 'もう一回！']));
    se('poke_jump', { rate: 0.8, gain: 0.8 });
    sfxBoing(settingsRef.current.volume * 0.5);
  };
  const handleTitlePoke = () => {
    handlePoke();
    if (kiaOn || deathOn) return;
    const now = performance.now(), pk = titlePokeRef.current;
    pk.n = Math.max(0, pk.n - Math.floor((now - pk.at) / 4000)) + 1;   // 4 秒さわらないと 1 つずつ落ち着く
    pk.at = now;
    sfxBoing(settingsRef.current.volume * 0.6);
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    if (pk.n <= 4) {
      const [r, t] = pick<[Reaction, string]>([['surprise', 'ひゃっ！'], ['giggle', 'くすぐったい〜'], ['shy', 'て、照れる…'], ['na', 'な！'], ['jump', 'ぴょん！'], ['spin', 'くるっ'], ['surprise', 'なになに？']]);
      showReact(t, r);
    } else if (pk.n <= 8) {
      const [r, t] = pick<[Reaction, string]>([['angry', 'ちょっと…'], ['dizzy', '目がまわる〜'], ['angry', 'もう！'], ['surprise', 'またぁ！？'], ['dizzy', 'くらくら…']]);
      showReact(t, r);
    } else if (pk.n <= 11) {
      // 画面の外から、きあきあの声がだんだん近づいてくる
      // 画面の外から足音がだんだん近づいてくる（文字は出さない）
      const lines: Record<number, [Reaction, string]> = {
        9: ['surprise', 'や、やめて…'],
        10: ['angry', 'ほんとに怒るよ…'],
        11: ['cry', 'もう…知らないからね…'],
      };
      const [r, t] = lines[pk.n];
      showReact(t, r);
      const n = pk.n;
      setTimeout(() => {
        se('knock', { gain: 0.2 + (n - 9) * 0.25, rate: 1.5, pan: 0.9 });
        se('knock', { gain: 0.2 + (n - 9) * 0.25, rate: 1.65, pan: 0.9, delay: 0.16 });
        if (n >= 11) { se('knock', { gain: 0.8, rate: 1.4, pan: 0.6, delay: 0.32 }); doShake('shake', 250); }
      }, 450);
    } else {
      showReact('ひっ…！', 'fear');
      pk.n = 0;
      kiaCountRef.current++;
      setTimeout(() => setKiaOn(true), 350);
    }
  };

  // しあしあをつつく
  const handlePoke = () => {
    bumpLife({ totalPokes: lifeRef.current.totalPokes + 1 });
    if (gameStateRef.current === 'PLAYING') runRef.current.pokes++;
    else checkAchievements(null, false);
  };

  const getBeat = useCallback(() => {
    const p = playerRef.current;
    if (!p || !p.started) return null;
    return (p.time() - 0.36) / BEAT;
  }, []);
  // 譜面は「耳に聞こえている所」に合わせて描く（スピーカー・イヤホンの遅れの分だけ遅らせる）
  const getTime = useCallback(() => playerRef.current?.audibleTime() ?? 0, []);

  /* ============================================================
   * 画面
   * ============================================================ */
  const stageVisible = gameState === 'RULES' || gameState === 'PLAYING' || gameState === 'PAUSED';
  const stageSize = isMobile ? 150 : 230;
  const atCut = !!cutIn && gameState === 'PLAYING';
  const stageMood: ShiashiaMood = atCut ? EVENT_MOOD[cutIn!.event] : tempMood ?? (gameState === 'RULES' ? 'idle' : 'dance');
  const stageTransform = (() => {
    if (!atCut) return 'translate(0px, 0px) scale(1)';
    const left = isMobile ? 0 : 24;
    const cx = left + stageSize / 2, cy = vp.h - stageSize / 2;
    const tx = vp.w * (isMobile ? 0.2 : 0.2) - cx;
    const ty = vp.h * (isMobile ? 0.345 : 0.31) - cy;
    const s = Math.max(1, Math.min(2.2, (vp.h * (isMobile ? 0.25 : 0.36)) / stageSize));
    return `translate(${tx}px, ${ty}px) scale(${s})`;
  })();

  const renderSettings = () => (
    <div className="bg-sky-100/95 backdrop-blur rounded-[1.5rem] border-4 border-white p-3 text-slate-700 flex flex-col gap-3 shadow-lg">
      <div className="bg-white/60 p-3 rounded-xl">
        <div className="flex justify-between mb-1 font-bold text-sky-600 text-sm"><span>おんりょう</span><span>{Math.round(settings.volume * 100)}%</span></div>
        <input id="vol" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(e) => setSettings({ volume: parseFloat(e.target.value) })} className="w-full" />
        <label className="flex items-center gap-2 mt-2 text-xs font-bold text-sky-700" htmlFor="clicks">
          <input id="clicks" type="checkbox" checked={settings.clicks} onChange={(e) => setSettings({ clicks: e.target.checked })} /> 拍にクリック音を入れる
        </label>
        <label className="flex items-center gap-2 mt-1.5 text-xs font-bold text-sky-700" htmlFor="hitsnd">
          <input id="hitsnd" type="checkbox" checked={settings.hitSound !== false} onChange={(e) => setSettings({ hitSound: e.target.checked })} /> タップ音（キーボード・タップで遊ぶとき）
        </label>
        <label className="flex items-center gap-2 mt-1.5 text-xs font-bold text-sky-700" htmlFor="voice">
          <input id="voice" type="checkbox" checked={settings.voice !== false} onChange={(e) => setSettings({ voice: e.target.checked })} /> アナウンスの声（3・2・1、COMBO、WINNER など）
        </label>
        <label className="flex items-center gap-2 mt-1.5 text-xs font-bold text-sky-700" htmlFor="lite">
          <input id="lite" type="checkbox" checked={lite} onChange={(e) => { setLiteAuto(false); setSettings({ lite: e.target.checked }); }} /> かるいモード（重いときに。画面の細かさと背景の飾りを減らす）
        </label>
        <label className="flex items-center gap-2 mt-1.5 text-xs font-bold text-sky-700" htmlFor="arcade">
          <input id="arcade" type="checkbox" checked={settings.arcade !== false} onChange={(e) => setSettings({ arcade: e.target.checked })} /> 画面チェンジ（譜面がいろんな音ゲー風に切り替わる）
        </label>
      </div>

      {!TAP_ONLY ? (
        <div className="bg-white/60 p-3 rounded-xl">
          <div className="font-bold text-sky-600 mb-2 text-sm">にゅうりょく</div>
          <div className="flex gap-2">
            {([['tap', 'キーボード・タップ'], ['mic', '声で「な」']] as const).map(([m, label]) => (
              <button key={m} onClick={() => chooseInput(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${settings.input === m ? 'bg-yellow-300 text-slate-800 shadow-[0_3px_0_#d97706]' : 'bg-white text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">キーはスペース・Enter・F・J（どれでも同じ）。声は「な」でなくても、声が出たら反応します。</div>
        </div>
      ) : (
        <div className="bg-white/60 p-3 rounded-xl text-xs text-slate-500 font-bold leading-relaxed">この版はキーボード・タップで「な」を伝えます。</div>
      )}

      {!TAP_ONLY && settings.input === 'mic' && (
        <div className="bg-white/70 p-3 rounded-xl flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sky-600 text-sm">マイクテスト</span>
            <button onClick={async () => { if (micTesting) { stopMic(); } else if (await ensureMic()) setMicTesting(true); }}
              className={`px-4 py-1.5 text-xs font-bold rounded-full border-2 ${micTesting ? 'bg-green-400 text-white border-green-200' : 'bg-white text-gray-400 border-gray-200'}`}>{micTesting ? 'ON' : 'OFF'}</button>
          </div>
          <select className="w-full text-sm p-2 rounded-lg border-2 border-sky-200 text-slate-600 bg-white" value={settings.deviceId} onChange={(e) => { setSettings({ deviceId: e.target.value }); stopMic(); }}>
            <option value="">いつものマイク</option>
            {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `マイク ${d.deviceId.slice(0, 5)}`}</option>)}
          </select>
          <LevelMeter mic={micRef.current} threshold={settings.threshold} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">はんのうライン</span>
            <input id="thr" type="range" min="5" max="90" value={settings.threshold} onChange={(e) => setSettings({ threshold: parseInt(e.target.value) })} className="flex-1" />
          </div>
        </div>
      )}

      <div className="bg-white/60 p-3 rounded-xl flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sky-600 text-sm">タイミング補正</span>
          <button onClick={async () => { setError(null); if (input === 'mic' && !(await ensureMic())) return; setGameState('CALIBRATE'); }} className="px-4 py-1.5 text-xs font-black rounded-full bg-white text-sky-600 border-2 border-sky-200">合わせる</button>
        </div>
        <div className="flex items-center gap-2">
          <input id="off" type="range" min="-150" max="350" step="5" value={Math.round((offsets[input] ?? 0) * 1000)} onChange={(e) => setOffset(input, parseInt(e.target.value) / 1000)} className="flex-1" />
          <span className="text-xs font-black text-slate-600 w-16 text-right tabular-nums">{offsets[input] == null ? '未設定' : `${Math.round(offsets[input]! * 1000)}ms`}</span>
        </div>
        <div className="text-[11px] text-slate-500 leading-snug">「おそい」と感じたら右へ。初めて遊ぶときは自動で合わせます。</div>
      </div>

      <div className="bg-white/60 p-3 rounded-xl">
        <div className="font-bold text-sky-600 mb-1 text-sm">BGMをえらぶ</div>
        <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBgmUrl(URL.createObjectURL(f)); setCustomUrl(''); } }}
          className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 mb-2" />
        <input type="text" placeholder="またはURLを入力" value={customUrl} onChange={(e) => { setCustomUrl(e.target.value); setBgmUrl(e.target.value || DEFAULT_BGM); }}
          className="w-full text-sm p-2 rounded-lg border-2 border-sky-200 text-slate-600 bg-white" />
        <div className="text-[11px] text-slate-500 mt-1 leading-tight">譜面は標準の曲に合わせてあります。別の曲だと音符と曲が合いません。</div>
      </div>
    </div>
  );

  const renderReady = () => {
    // 画面が割れている間は、しあしあのひとことも割れた画面の話になる
    const CRACK_LINES = ['画面、バキバキ…', '修理代… 配信で稼がなきゃ', 'きあきあ、やりすぎ…', 'ひび割れ配信って、バズるかな？', 'ガラスの破片、ふまないでね', '右上で直せるって…'];
    const say = kiaOn ? 'ひぃぃ…' : reactSay?.text || (crackSeed && !crackFixing ? CRACK_LINES[storyIdx % CRACK_LINES.length] : STORY[storyIdx]?.say) || '';
    const sceneSize = isMobile ? Math.round(Math.min(330, vp.w - 40, vp.h * 0.3)) : 340;
    return (
      <div className="w-full h-full overflow-y-auto overflow-x-hidden relative z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="min-h-full w-full max-w-5xl mx-auto px-4 py-5 md:py-8 grid md:grid-cols-2 gap-4 md:gap-8 items-center">
          {/* 左：タイトルと、椅子のしあしあ */}
          <div className="flex flex-col items-center text-center min-w-0">
            <div className="mb-1.5 bg-yellow-300 text-slate-800 px-4 py-1 rounded-full font-black text-xs md:text-sm border-2 md:border-4 border-white shadow-md -rotate-2">底辺チューバーからの脱却</div>
            <div className="flex flex-col items-center -rotate-1 select-none">
              <div className="flex items-end justify-center flex-wrap gap-x-1.5">
                <button key={logo.id} onClick={() => { setLogo((l) => ({ i: l.i + 1, id: performance.now() })); sfxBoing(settingsRef.current.volume); }}
                  className={`text-6xl sm:text-7xl md:text-8xl font-black text-pink-500 leading-none drop-shadow-xl ${logo.id ? 'logo-spin' : ''}`} style={{ WebkitTextStroke: '3px white', paintOrder: 'stroke fill' }} aria-label="名">
                  {['名', 'な', 'ナ', '奈', '那', '菜', 'na'][logo.i % 7]}
                </button>
                <span className="text-xl sm:text-3xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2px white', paintOrder: 'stroke fill' }}>を</span>
                <span className="text-3xl sm:text-5xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2.5px white', paintOrder: 'stroke fill' }}>たくさん</span>
                <span className="text-2xl sm:text-4xl font-black text-slate-800 leading-none" style={{ WebkitTextStroke: '2px white', paintOrder: 'stroke fill' }}>伝えれる</span>
              </div>
              <span className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-800 mt-1" style={{ WebkitTextStroke: '3px white', paintOrder: 'stroke fill' }}>画期的ツール</span>
            </div>
            <div className="text-slate-400 text-[10px] md:text-xs font-bold mt-1 tracking-widest bg-white/60 px-3 py-0.5 rounded-full">的なもの</div>

            <div className="relative mt-2" style={{ width: sceneSize, height: sceneSize }}>
              {/* しあしあの部屋（透けない背景）：やわらかい色の丸い窓 */}
              <div className="absolute inset-[6%] rounded-full border-4 border-white shadow-[0_6px_0_rgba(236,72,153,0.18),inset_0_-14px_30px_rgba(236,72,153,0.12)] overflow-hidden"
                style={{ background: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #fdf4ff 40%, #fce7f3 75%, #fbcfe8 100%)' }}>
                <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: 'linear-gradient(#f5d0fe00, #f5d0fe66)' }} />
              </div>
              <div className="absolute inset-0">
                <ShiashiaSeated size={sceneSize} onPoke={handleTitlePoke} onBeat={setStoryIdx} reactRef={seatedReactRef}
                  getMusicTime={() => { const el = menuBgmRef.current; return el && !el.paused ? el.currentTime : null; }}
                  onGrab={handleTitleGrab} onDrop={handleTitleDrop} />
              </div>
              {say && (
                <div key={reactSay?.id ?? storyIdx} className="bubble-in absolute top-[3%] left-1/2 -translate-x-1/2 max-w-[90%] pointer-events-none">
                  <div className="relative bg-white border-4 border-slate-800 rounded-2xl px-3.5 py-1.5 text-slate-800 font-black text-sm md:text-base whitespace-nowrap shadow-[4px_4px_0_rgba(30,41,59,0.25)]">
                    {say}
                    <span className="absolute left-1/2 -bottom-[12px] -translate-x-1/2 w-0 h-0 border-x-[9px] border-x-transparent border-t-[12px] border-t-slate-800" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右：あそぶ */}
          <div className="flex flex-col gap-3 min-w-0 w-full max-w-md mx-auto">
            <div className="bg-white/90 backdrop-blur rounded-2xl p-3 shadow-[0_4px_0_rgba(0,0,0,0.08)] border-4 border-white flex flex-col gap-2">
              {!TAP_ONLY && (
                <>
                  <div className="text-cyan-600 font-bold text-center text-sm">あそびかた</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['tap', 'mic'] as const).map((m) => (
                      <button key={m} onClick={() => chooseInput(m)}
                        className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center leading-tight ${input === m ? 'bg-violet-500 text-white shadow-[0_3px_0_#6d28d9] -translate-y-px' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="font-black text-sm">{m === 'tap' ? 'キーボード・タップ' : '声で「な」'}</span>
                        <span className={`text-[10px] font-bold ${input === m ? 'text-white/80' : 'text-gray-400'}`}>{m === 'tap' ? 'スペース / F / J / 画面タップ' : 'マイクに向かって「な」'}</span>
                      </button>
                    ))}
                  </div>
                  {input === 'mic' && <div className={`text-[10px] text-center font-bold ${micOn ? 'text-emerald-600' : 'text-slate-500'}`}>{micOn ? 'マイクOK。イヤホンだと曲の音を拾いにくい' : '「始める！」でマイクの許可をたずねます'}</div>}
                  {error && /マイク/.test(error) && <div className="text-[11px] text-center font-bold text-white bg-red-400 rounded-lg px-2 py-1.5">{error}</div>}
                </>
              )}
              {input === 'tap' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['easy', 'normal'] as const).map((m) => (
                    <button key={m} onClick={() => setSettings({ tapMode: m })}
                      className={`py-1.5 px-1 rounded-xl transition-all flex flex-col items-center leading-tight border-2 ${(settings.tapMode ?? 'easy') === m ? 'bg-cyan-500 border-cyan-500 text-white shadow-[0_3px_0_#0e7490] -translate-y-px' : 'bg-white border-gray-200 text-gray-500'}`}>
                      <span className="font-black text-sm">{m === 'easy' ? '簡単モード' : '通常モード'}</span>
                      <span className={`text-[10px] font-bold ${(settings.tapMode ?? 'easy') === m ? 'text-white/85' : 'text-gray-400'}`}>{m === 'easy' ? 'どこをタップしてもOK' : 'ノーツの場所をタップ'}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-cyan-600 font-bold text-center text-sm mt-0.5">モードとむずかしさ</div>
              <div className="grid grid-cols-3 gap-2">
                {(['10s', '30s', 'FULL'] as GameMode[]).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center gap-0.5 ${mode === m ? 'bg-yellow-300 text-slate-800 shadow-[0_3px_0_#d97706] -translate-y-px' : 'bg-gray-100 text-gray-500'}`}>
                    <span className="font-black text-base">{MODE_LABEL[m]}</span>
                    <span className="text-[10px] font-bold">ノルマ {fmtSubs(QUOTA[m])}人</span>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 text-center font-bold leading-snug">{MODE_DESC[mode]}</div>
              <div className="grid grid-cols-3 gap-2 mt-0.5">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                  <button key={d} onClick={() => setSettings({ difficulty: d })}
                    className={`py-1.5 px-1 rounded-xl transition-all font-black text-sm ${difficulty === d ? (d === 'easy' ? 'bg-emerald-400 text-white shadow-[0_3px_0_#059669]' : d === 'normal' ? 'bg-sky-400 text-white shadow-[0_3px_0_#0284c7]' : 'bg-rose-500 text-white shadow-[0_3px_0_#be123c]') + ' -translate-y-px' : 'bg-gray-100 text-gray-500'}`}>
                    {DIFF_LABEL[d]}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 text-center font-bold leading-snug">{DIFF_DESC[difficulty]}{input === 'mic' && difficulty === 'hard' ? '（声だと速すぎるかも）' : ''}</div>
            </div>

            <button data-sfx="ui_start" onClick={handleStart} className="group relative w-full focus:outline-none transition-transform active:scale-95 duration-200 h-[104px] md:h-[132px]">
              <div className="absolute inset-0 bg-pink-300 rounded-[2rem] translate-y-2" />
              <div className="absolute inset-0 bg-gradient-to-b from-pink-400 to-pink-500 rounded-[2rem] border-4 border-white flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute top-[-30%] left-[-10%] w-32 h-32 bg-white/20 rotate-45" />
                <span className="text-4xl md:text-5xl font-black text-white drop-shadow-md z-10">始める！</span>
                <span className="mt-1.5 z-10 text-sm md:text-base font-bold text-white bg-white/25 rounded-full px-4 py-1">{MODE_LABEL[mode]}・{DIFF_LABEL[difficulty]}・{INPUT_LABEL[input]}で 登録者{fmtSubs(QUOTA[mode])}人</span>
              </div>
            </button>

            {/* OP の曲の切り替え */}
            <div className="bg-white/90 rounded-2xl px-3 py-2 border-4 border-white shadow-[0_4px_0_rgba(0,0,0,0.08)] flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 shrink-0">OPの曲</span>
              <div className="flex-1 grid grid-cols-3 gap-1">
                {MENU_BGMS.map((b) => (
                  <button key={b.id} onClick={() => setSettings({ menuBgm: b.id })}
                    className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-black transition-all ${settings.menuBgm === b.id ? 'bg-pink-500 text-white shadow-[0_2px_0_#be185d]' : 'bg-slate-100 text-slate-500'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowBook(true)} className="bg-white/90 rounded-2xl py-3 px-3 border-4 border-white shadow-[0_4px_0_rgba(0,0,0,0.08)] active:scale-95 transition-transform flex flex-col items-center">
                <span className="font-black text-slate-700">ずかん</span>
                <span className="text-[10px] font-bold text-slate-400">実績 {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}・エンド {countSeen(seenEndings)}/{TOTAL_ENDINGS}</span>
              </button>
              <button onClick={() => setShowSettings((v) => !v)} className={`rounded-2xl py-3 px-3 border-4 border-white shadow-[0_4px_0_rgba(0,0,0,0.08)] active:scale-95 transition-transform flex flex-col items-center ${showSettings ? 'bg-sky-300 text-white' : 'bg-white/90 text-slate-700'}`}>
                <span className="font-black">せってい</span>
                <span className={`text-[10px] font-bold ${showSettings ? 'text-white/80' : 'text-slate-400'}`}>{input === 'mic' ? '声' : 'キー・タップ'}・補正 {offsets[input] == null ? '未設定' : `${Math.round(offsets[input]! * 1000)}ms`}</span>
              </button>
            </div>
            <button data-nosfx onClick={() => { setShowFortune(true); bumpLife({ fortunes: (lifeRef.current.fortunes ?? 0) + 1 }); checkAchievements(null, false); }}
              className="bg-white/90 rounded-2xl py-2.5 px-3 border-4 border-white shadow-[0_4px_0_rgba(0,0,0,0.08)] active:scale-95 transition-transform flex items-center justify-center gap-2">
              <span className="font-black text-pink-500">今日のな占い</span>
              <span className="text-[10px] font-bold text-slate-400">配信運を占う（1 日 1 回変わる）</span>
            </button>
            {showSettings && <div ref={settingsBoxRef} className="scroll-mt-4">{renderSettings()}</div>}
            {error && !/マイク/.test(error) && <div className="bg-red-400 text-white font-bold p-3 rounded-xl border-4 border-white shadow-lg text-center text-sm">{error}</div>}
          </div>
        </div>
      </div>
    );
  };

  /**
   * プレイ中の画面の「あいている所」。譜面（押す所）の上と下。カットイン・special「な」・アイテムの文字は、ここに出して譜面と重ねない
   */
  const playAreas = () => {
    const trackH = Math.round(Math.min(420, vp.h * 0.5));
    const half = trackStyle === 'lane' ? 64 : trackH / 2 + 4;
    const tTop = vp.h * 0.54 - half, tBot = vp.h * 0.54 + half;
    const safeT = isMobile ? 24 : 8;
    return { tTop, tBot, top: { y: safeT, h: Math.max(0, tTop - safeT - 6) }, bottom: { y: tBot + 6, h: Math.max(0, vp.h - tBot - 14) } };
  };
  const renderPlaying = () => {
    const ratio = subs / quota;
    const trackH = Math.round(Math.min(420, vp.h * 0.5));
    const laneStyle = trackStyle === 'lane';
    const nuNow = activeFx.includes('nu');
    const actionWord = input === 'mic' ? (nuNow ? '「ぬ」' : '「な」') : isMobile ? 'タップ' : '押す';
    const hasFx = (id: ItemId) => activeFx.includes(id);
    return (
      <>
        {/* 上：時間の細いバー */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-pink-100 z-40"><div ref={timeBarRef} className="h-full w-full bg-pink-400 origin-left transition-transform duration-100" /></div>

        <button data-noinput onPointerDown={(e) => e.stopPropagation()} onClick={pauseGame} style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
          className="absolute left-3 z-50 bg-white/90 text-slate-500 hover:bg-yellow-300 hover:text-white border-4 border-slate-200 rounded-full w-12 h-12 flex items-center justify-center shadow-md" aria-label="一時停止">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        </button>

        {/* 上：登録者（＝ノルマ）・視聴者・警告。スマホは縦に並べる */}
        {(() => {
          const viewersBox = (
            <div className={`bg-white/90 rounded-2xl px-2.5 py-1.5 border-4 shadow-md ${isMobile ? 'flex-1' : 'w-40'} ${viewers <= 20 ? 'border-red-500 animate-pulse' : buzz ? 'border-amber-400' : 'border-slate-200'}`}>
              <div className="flex justify-between text-[10px] font-black">
                <span className={viewers <= 20 ? 'text-red-500' : 'text-slate-500'}>{viewers <= 20 ? '離脱寸前' : '視聴者'}</span>
                <span className="text-slate-600 tabular-nums">{viewers}</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                <div className={`h-full transition-[width] duration-150 ${viewers <= 20 ? 'bg-red-500' : viewers >= 85 ? 'bg-amber-400' : 'bg-slate-500'}`} style={{ width: `${viewers}%` }} />
              </div>
            </div>
          );
          const strikesBox = (
            <div className="flex items-center gap-1 bg-white/90 rounded-full px-2.5 py-1 border-2 border-slate-200 shrink-0">
              <span className="text-[10px] font-black text-slate-500">警告</span>
              {Array.from({ length: BAN_STRIKES }).map((_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < strikes ? 'bg-red-500' : 'bg-slate-200'}`} />)}
            </div>
          );
          const quotaBar = (
            <div className="w-full">
              <div className="flex justify-between text-[10px] md:text-xs font-black px-1">
                <span className={ratio >= 1 ? 'text-amber-500' : 'text-cyan-600'}>{ratio >= 1 ? 'ノルマ達成' : 'ノルマ'} {fmtSubs(quota)}人</span>
                <span className="text-slate-500 tabular-nums">{ratio >= 1 ? `${ratio.toFixed(1)}倍` : `${Math.floor(ratio * 100)}%`}</span>
              </div>
              <div className="h-3.5 bg-white/90 rounded-full overflow-hidden border-2 border-white shadow">
                <div className={`h-full transition-[width] duration-200 ${ratio >= 1 ? 'bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500' : 'bg-cyan-400'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
            </div>
          );
          const subsBox = (
            <div className={`bg-white/90 backdrop-blur rounded-3xl px-5 md:px-8 pt-1 pb-1.5 border-b-[6px] shadow-xl text-center ${buzz ? 'border-amber-400' : ratio >= 1 ? 'border-yellow-300' : 'border-slate-200'}`}>
              <div className="text-[10px] md:text-xs font-bold text-slate-400 tracking-wider">チャンネル登録者数</div>
              <SubsCounter value={subs} big />
            </div>
          );
          return isMobile ? (
            <div className="absolute left-0 right-0 z-30 flex flex-col items-stretch gap-1.5 pointer-events-none px-3" style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}>
              <div className="flex items-start justify-center pl-12 pr-12">{subsBox}</div>
              {quotaBar}
              <div className="flex items-center gap-2">{viewersBox}{strikesBox}</div>
            </div>
          ) : (
            <>
              <div className="absolute top-3 left-0 right-0 z-30 flex flex-col items-center pointer-events-none px-48">
                {subsBox}
                <div className="mt-2 w-[min(520px,100%)]">{quotaBar}</div>
              </div>
              <div className="absolute top-3 right-3 z-40 flex flex-col items-end gap-1.5 pointer-events-none">{viewersBox}{strikesBox}</div>
            </>
          );
        })()}

        {/* アイテム効果 */}
        {itemCard && performance.now() < itemCard.until + 400 && (
          <div key={itemCard.id} className="item-in absolute left-1/2 -translate-x-1/2 z-[45] pointer-events-none" style={{ top: (() => { const A = playAreas(); return A.bottom.h >= 90 ? A.bottom.y + 4 : Math.max(A.top.y, A.top.y + A.top.h - 92); })() }}>
            <div className={`bg-gradient-to-r ${ITEM_COLOR[itemCard.def.kind]} text-white rounded-2xl px-4 py-2 border-4 border-white shadow-xl text-center min-w-[220px]`}>
              <div className="text-[10px] font-black tracking-widest opacity-80">special「な」</div>
              <div className="font-black text-lg md:text-2xl leading-tight">{itemCard.def.name}</div>
              <div className="text-[11px] font-bold opacity-90">{itemCard.def.desc}</div>
              <div className="h-1.5 bg-white/30 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-white item-bar" style={{ animationDuration: `${itemCard.total}ms` }} /></div>
            </div>
          </div>
        )}

        {/* 判定・コンボ（レーンのすぐ上） */}
        <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-end justify-center gap-4" style={{ top: laneStyle ? 'calc(54% - 92px)' : `calc(54% - ${trackH / 2 + 12}px)`, height: 44 }}>
          {combo >= 3 && (
            <div className="flex items-baseline gap-1 bg-white/80 rounded-full px-3 py-0.5">
              <span className="font-black text-2xl text-slate-800 tabular-nums">{combo}</span>
              <span className="text-[10px] font-black text-slate-500">COMBO</span>
              <span className="text-xs font-black text-pink-500 ml-1 tabular-nums">×{(comboMul(combo, chartRef.current.comboFull) * viewerMul(viewers) * (buzz ? 2 : 1)).toFixed(1)}</span>
            </div>
          )}
          {judge && <div key={judge.id} className={`judge-pop font-black text-2xl md:text-3xl ${judge.cls}`} style={{ WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}>{judge.text}</div>}
        </div>

        {/* 譜面 */}
        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `calc(54% - ${trackH / 2}px)` }}>
          <Track getTime={getTime} notesRef={notesRef} burnsRef={burnsRef} flagsRef={flagsRef} scheduleRef={scheduleRef} height={trackH} action={actionWord} hitPosRef={hitPosRef} />
        </div>
        <BurnFx data={burnFx} textTop={(() => { const A = playAreas(); return A.top.y + A.top.h * 0.5; })()} />
        {/* してみた動画（リズム天国風）：画面いっぱいに切り替わる舞台（背景・3D のきあきあとしあしあ・手前の飾り）。譜面より奥 */}
        {scheduleRef.current.some((sg) => sg.style === 'heaven') && (
          <div className="absolute inset-0 z-[19] pointer-events-none">
            <HeavenStage getTime={getTime} notesRef={notesRef} burnsRef={burnsRef} scheduleRef={scheduleRef} visible={trackStyle === 'heaven'} band={(() => { const A = playAreas(); return { y0: A.tTop, y1: A.tBot }; })()} />
          </div>
        )}
        {/* 画面チェンジのお知らせ（譜面の下に出す。譜面は隠さない） */}
        {styleBanner && (
          <div key={styleBanner.id} className="absolute left-0 right-0 z-30 pointer-events-none flex justify-center px-3" style={{ top: `calc(54% + ${laneStyle ? 62 : trackH / 2 - 6}px)` }}>
            <div className="mode-change flex items-center gap-3 bg-slate-900/92 text-white rounded-2xl pl-2 pr-4 py-2 border-2 border-yellow-300 shadow-xl max-w-[min(94vw,520px)]">
              <span className="shrink-0 text-[9px] font-black tracking-[0.2em] bg-gradient-to-r from-pink-500 to-violet-500 rounded-md px-1.5 py-1 leading-none">MODE<br />CHANGE</span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="font-black text-lg">{styleBanner.style === 'heaven' ? HEAVEN_GAMES[scheduleRef.current[styleBanner.id]?.games?.[0] ?? 'plane'].title : STYLE_INFO[styleBanner.style].label}<span className="text-xs font-bold text-white/60 ml-2">やることは同じ</span></span>
                <span className="text-[11px] font-bold text-white/85">{STYLE_INFO[styleBanner.style].hint}</span>
                <span className="text-sm font-black text-yellow-300">→ {input === 'mic' ? `${nuNow ? '「ぬ」' : '「な」'}と言う` : settings.tapMode === 'normal' ? (styleBanner.style === 'heaven' ? 'どこでもタップ' : 'ノーツの場所をタップ') : isMobile ? '画面をタップ' : 'キーを押す'}</span>
              </span>
            </div>
          </div>
        )}
        <div className="absolute left-0 right-0 z-20" style={{ top: laneStyle ? 'calc(54% + 58px)' : `calc(54% + ${trackH / 2 + 4}px)`, display: styleBanner ? 'none' : undefined }}>
          <div className="flex justify-center gap-2 mt-1 pointer-events-none">
            {activeFx.length > 0 && activeFx.map((id) => (
              <span key={id} className="text-[10px] font-black text-white bg-slate-800/80 rounded-full px-2 py-0.5">
                {id === 'bpmUp' ? 'BPM UP' : id === 'bpmDown' ? 'BPM DOWN' : id === 'mirror' ? 'ミラー' : id === 'nu' ? '「ぬ」' : id === 'thumbnail' ? 'サムネ詐欺' : id === 'godMic' ? '神マイク' : id === 'superchat' ? 'スパチャ×3' : ''}
              </span>
            ))}
          </div>
        </div>

        {/* カウントダウン（曲のイントロで数える） */}
        {countdown && (
          <div className="absolute inset-x-0 z-40 pointer-events-none flex justify-center" style={{ top: 'calc(54% + 70px)' }}>
            <div key={countdown} className="animate-impact font-black text-white text-5xl md:text-7xl" style={{ WebkitTextStroke: '6px #ec4899', paintOrder: 'stroke fill' }}>{countdown}</div>
          </div>
        )}

        {/* special「な」 */}
        {specials.map((s) => (
          <button key={s.id} data-noinput data-nosfx onPointerDown={(e) => takeItem(s.id, e)}
            className="special-fly absolute z-[55] w-20 h-20 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center text-white font-black border-4 border-white shadow-2xl"
            style={{ top: `${s.top}%`, left: '100%', ['--dur' as any]: `${s.dur}ms`, background: 'conic-gradient(from 0deg,#f472b6,#a78bfa,#38bdf8,#4ade80,#facc15,#f472b6)' }}
            aria-label="special な">
            <span className="text-3xl md:text-4xl leading-none" style={{ WebkitTextStroke: '3px #7c3aed', paintOrder: 'stroke fill' }}>{hasFx('nu') ? 'ぬ' : 'な'}</span>
            <span className="text-[8px] md:text-[10px] tracking-widest bg-violet-700/80 rounded-full px-1.5 mt-0.5">special</span>
          </button>
        ))}
      </>
    );
  };

  const renderContent = () => {
    switch (gameState) {
      case 'READY': return renderReady();
      case 'CALIBRATE':
        return (
          <Calibration input={input} mic={input === 'mic' ? micRef.current : null} volume={settings.volume}
            onDone={(off) => {
              setOffset(input, off);
              bumpLife({ calibrated: true });
              checkAchievements(null, false);
              micRef.current.onOnset = () => handleInputRef.current('mic');
              setGameState(playerRef.current ? 'RULES' : 'READY');
            }}
            onCancel={() => {
              if (offsetsRef.current[input] == null) setOffset(input, 0);
              micRef.current.onOnset = () => handleInputRef.current('mic');
              setGameState(playerRef.current ? 'RULES' : 'READY');
            }} />
        );
      case 'RULES':
        return (
          <RulesCard mode={mode} difficulty={difficulty} input={input} onInputChange={TAP_ONLY ? undefined : async (m) => { const ok = await chooseInput(m); if (ok && offsetsRef.current[m] == null) setGameState('CALIBRATE'); }} ready={songReady} offsetMs={offsets[input] == null ? null : Math.round(offsets[input]! * 1000)}
            skip={skipRules} onSkipChange={(v) => { setSkipRules(v); try { localStorage.setItem(LS_KEYS.skipRules, v ? '1' : '0'); } catch { /* noop */ } }}
            onStart={startPlay} onCalibrate={() => setGameState('CALIBRATE')} onBack={() => { if (input === 'mic') stopMic(); setGameState('READY'); }} />
        );
      case 'PLAYING': return renderPlaying();
      case 'PAUSED':
        return (
          <>
            <div className="absolute inset-0 pointer-events-none opacity-60 blur-sm">{renderPlaying()}</div>
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white/95 p-7 rounded-[3rem] border-8 border-yellow-300 shadow-2xl flex flex-col items-center gap-4 animate-[pop_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] min-w-[300px]">
                <h2 className="text-4xl font-black text-slate-700 mb-1">一 時 停 止</h2>
                <button onClick={resumeGame} className="w-60 py-3.5 text-xl font-bold text-white bg-pink-500 rounded-full border-4 border-white shadow-lg">続ける</button>
                <button onClick={() => { finishingRef.current = true; clearCuts(); startPlay(); }} className="w-60 py-3.5 text-xl font-bold text-slate-600 bg-yellow-300 rounded-full border-4 border-white shadow-lg">初めから</button>
                <button onClick={quitToTitle} className="w-60 py-3.5 text-xl font-bold text-slate-500 bg-gray-200 rounded-full border-4 border-white shadow-lg">やめる</button>
              </div>
            </div>
          </>
        );
      case 'ENDING':
        return ending ? <EndingScene ending={ending} isNew={endingIsNew} notFull={!luckyRef.current && runRef.current.mode !== 'FULL'} volume={settings.volume} audioCtx={playerRef.current?.ctx ?? null} onDone={() => { if (luckyRef.current) { luckyRef.current = false; setEnding(null); setGameState('READY'); } else setGameState('FINISHED'); }} /> : null;
      case 'FINISHED':
        return (
          <ResultScreen run={runRef.current} revealT={revealT} ending={ending} endingIsNew={endingIsNew} isNewRecord={isNewRecordRef.current}
            newlyIds={runUnlockedRef.current} highScores={highScores}
            timing={(() => { const a = [...dtsRef.current].sort((x, y) => x - y); return a.length >= 8 ? { ms: Math.round(a[a.length >> 1] * 1000), n: a.length } : null; })()}
            onApplyTiming={(ms) => { const k = runRef.current.input; setOffset(k, Math.round((effOffset(k) + ms / 1000) * 1000) / 1000); dtsRef.current = []; }}
            onTitle={() => setGameState('READY')}
            onRetry={async () => { prepareSong(); if (input === 'mic' && !(await ensureMic())) return; setGameState('RULES'); }}
            onBook={() => setShowBook(true)} />
        );
    }
  };

  const playing = gameState === 'PLAYING';
  const bgClass = buzz && playing ? 'bg-fever' : 'bg-polka';

  return (
    <div
      className={`w-full h-full flex items-center justify-center relative overflow-hidden ${bgClass} select-none ${shake}`}
      style={{ touchAction: playing ? 'none' : undefined }}
      onPointerDown={playing && input === 'tap' ? (e) => { if ((e.target as HTMLElement).closest('[data-noinput]')) return; e.preventDefault(); pointersDownRef.current.add(e.pointerId); handleInputRef.current('tap', { x: e.clientX, y: e.clientY }); } : undefined}
    >
      <audio ref={menuBgmRef} loop preload="auto" src={ASSET_BASE + (MENU_BGMS.find((x) => x.id === settings.menuBgm) || MENU_BGMS[0]).file} />

      {(playing || gameState === 'PAUSED') && <Crowd subs={subs} buzz={buzz} />}
      {(playing || gameState === 'PAUSED') && (
        <CommentStream active={playing} level={lite ? chaos * 0.5 : chaos} mood={commentMood} sparse={isMobile || lite}
          avoid={(() => { const th = Math.min(420, vp.h * 0.5); const half = trackStyle === 'lane' ? 60 : th / 2; return [((vp.h * 0.54 - half) / vp.h) * 100, ((vp.h * 0.54 + half) / vp.h) * 100] as [number, number]; })()} />
      )}
      {buzz && playing && <div className="fever-glow absolute inset-0 z-[2] pointer-events-none" />}
      <NaEffects particles={particles} onClickSpecial={() => {}} front={(playing && trackStyle !== 'lane') || gameState === 'READY'} />

      {renderContent()}

      {/* しあしあ（説明〜プレイ中は 1 体だけ。カットインのときは画面の左上へ飛んでくる） */}
      {stageVisible && (
        <div data-noinput onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 md:left-6 pointer-events-auto"
          style={{
            zIndex: atCut ? 62 : 25,
            transform: stageTransform,
            transformOrigin: '50% 50%',
            transition: atCut ? 'transform 700ms cubic-bezier(0.34, 1.45, 0.64, 1)' : 'transform 520ms cubic-bezier(0.65, 0, 0.35, 1)',
            opacity: gameState === 'RULES' && !isMobile ? 1 : undefined,
            // してみた動画のあいだは、ゲーム機の画面の中にキャラがいるので隠す
            visibility: playing && trackStyle === 'heaven' && !atCut ? 'hidden' : undefined,
          }}>
          <Shiashia3D getBeat={getBeat} hitRef={hitRef} mood={stageMood} intensity={Math.min(1, combo / 40)} size={stageSize}
            onPoke={handlePoke} withPartner partner={atCut && cutIn?.event === 'collab'} paused={playing && trackStyle === 'heaven' && !atCut} />
        </div>
      )}

      {playing && <EventCutIn data={cutIn} mobile={isMobile} area={(() => { const A = playAreas(); return A.top.h >= 120 || A.top.h >= A.bottom.h ? A.top : A.bottom; })()} />}
      {banFlash && playing && <div className="absolute inset-0 z-[58] bg-red-700/40 pointer-events-none flash-white" />}

      {gameState !== 'PLAYING' && <AchievementToasts toasts={toasts} />}
      {luckyFx && (
        <div className="fixed inset-0 z-[90] pointer-events-auto flex items-center justify-center bg-fuchsia-500/30">
          <div className="absolute inset-0 bg-white flash-white" />
          {['この子だれ？', '切り抜き、伸びてる', 'トレンド 1 位', '通知が止まらない'].map((c, i) => (
            <div key={i} className="absolute lucky-in bg-white text-slate-700 font-black text-sm rounded-2xl px-3 py-2 border-2 border-fuchsia-300 shadow-lg whitespace-nowrap"
              style={{ top: `${18 + i * 15}%`, left: `${i % 2 ? 46 : 8}%`, animationDelay: `${0.2 + i * 0.22}s`, opacity: 0 }}>{c}</div>
          ))}
          <div className="relative lucky-in text-5xl sm:text-6xl font-black text-fuchsia-600" style={{ WebkitTextStroke: '8px #fff', paintOrder: 'stroke fill', animationDelay: '0.1s', opacity: 0 }}>バズった！？</div>
        </div>
      )}
      {gameState === 'READY' && <NaBubbles volume={settings.volume} total={titlePops} disabled={kiaOn || deathOn || luckyFx} onBurst={spawnBalloonNa} onRare={startLucky}
        onPop={(n) => { const v = (lifeRef.current.titlePops ?? 0) + n; bumpLife({ titlePops: v }); setTitlePops(v); if (v >= 50 && v - n < 50) checkAchievements(null, false); }} />}
      {kiaOn && <KiaKiaPunch volume={settings.volume} onShout={() => doShake('shake-hard', 600)}
        onImpact={() => { const lv = Math.max(1, Math.min(3, kiaCountRef.current)); setCrackLevel(lv); setCrackSeed((Date.now() % 99991) + 1); doShake('shake-hard', 700 + 300 * (lv - 1)); if (lv >= 2) { se('glass_crash', { gain: 0.5 + 0.2 * lv, rate: 0.85, delay: 0.08 }); se('boom_low', { gain: 0.6 * lv }); } bumpLife({ screenBroken: true }); checkAchievements(null, false); }}
        onDone={() => {
          setKiaOn(false);
          const n = kiaCountRef.current;
          if (n >= 3) { setTimeout(() => setDeathOn(true), 250); return; }
          setTimeout(() => showReact(n === 2 ? 'つ、次はほんとに こわれちゃう…' : 'が、画面が…！', n === 2 ? 'fear' : 'surprise'), 200);
        }} />}
      {deathOn && <ScreenDeath volume={settings.volume}
        achievement={unlockedRef.current.kia_gameover ? null : achievementById('kia_gameover') ?? null}
        onRestore={() => { setCrackSeed(null); setCrackFixing(false); kiaCountRef.current = 0; titlePokeRef.current.n = 0; bumpLife({ screenDead: true }); checkAchievements(null, true); }}
        onDone={() => { setDeathOn(false); setTimeout(() => showReact('ピカピカの 新しい画面！', 'jump'), 150); }} />}
      {crackSeed && gameState === 'READY' && (
        <GlassCrack key={crackSeed} seed={crackSeed} level={crackLevel} impact={{ x: vp.w * [0.5, 0.42, 0.56][crackLevel - 1], y: vp.h * [0.46, 0.42, 0.5][crackLevel - 1] }} volume={settings.volume} lite={lite} fixing={crackFixing}
          onFixed={() => { setCrackSeed(null); setCrackFixing(false); showReact('直った！', 'jump'); }} />
      )}
      {crackSeed && gameState === 'READY' && !kiaOn && !deathOn && !crackFixing && (
        <button data-nosfx onClick={() => { setCrackFixing(true); se('rewind', { rate: 0.8 }); se('glass_small', { rate: 2.2, delay: 0.25, gain: 0.5 }); se('fix', { delay: 0.6 }); }}
          style={{ top: 'max(10px, env(safe-area-inset-top))' }}
          className="fixed z-[86] right-3 bg-slate-900/85 text-white font-black text-sm px-5 py-2.5 rounded-full border-2 border-white shadow-xl active:scale-95 transition-transform">
          画面を直す
        </button>
      )}
      {showFortune && <FortuneCard volume={settings.volume} onClose={() => setShowFortune(false)} />}
      {showBook && <CollectionBook unlocked={unlocked} seenEndings={seenEndings} itemsSeen={lifeRef.current.itemsSeen} onClose={() => setShowBook(false)} />}
    </div>
  );
};

export default Game;
