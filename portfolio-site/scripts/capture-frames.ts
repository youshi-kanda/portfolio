/**
 * capture-frames.ts — SVQ の 5 フレームを撮る
 *
 * ART-DIRECTION-REVIEW.md §3 の F1–F5 を、REAL（実描画）と BLIND（意味を消した
 * 描画）の 2 通りで撮る。Chrome + CDP を直接叩く。deviceScaleFactor は 1 固定で、
 * filter・色補正・演出目的のトリミングは一切かけない。
 *
 *   node scripts/capture-frames.ts --out <dir> [--url http://localhost:4321]
 *
 * BLIND は「文章の意味を読まなくても構図が成立しているか」を見るための診断で
 * あって Gate ではない。文字数・行数の完全一致は目指さない（§4）。テキストノード
 * 単位で同じ長さのダミーに置換し、scrollHeight の差は測って記録するだけにする。
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const argOf = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const OUT = argOf("--out");
const BASE = argOf("--url", "http://localhost:4321")!;
if (!OUT) throw new Error("--out <dir> is required");

const CHROME = "/usr/bin/google-chrome";
const PORT = 9333;

/** 撮る 5 フレーム。scrollTo は DOM から解決する（数値をここに書かない）。 */
type Frame = {
  name: string;
  viewport: { width: number; height: number; mobile: boolean };
  path: string;
  full?: true;
  /** viewport 上端に来て欲しい要素。無ければ scrollY 0 */
  anchor?: string;
};
const FRAMES: Frame[] = [
  { name: "F1-full",      viewport: { width: 1440, height: 900, mobile: false }, path: "/", full: true },
  { name: "F2-first",     viewport: { width: 1440, height: 900, mobile: false }, path: "/" },
  { name: "F3-work",      viewport: { width: 1440, height: 900, mobile: false }, path: "/", anchor: "#work" },
  { name: "F4-m-first",   viewport: { width: 390,  height: 844, mobile: true  }, path: "/" },
  { name: "F5-m-project", viewport: { width: 390,  height: 844, mobile: true  }, path: "/",
    anchor: "section[role=lead], #work + section" },
];

/* ------------------------------------------------------------------ CDP */

let msgId = 0;
type Pending = { resolve: (v: any) => void; reject: (e: any) => void };

class Cdp {
  ws: WebSocket;
  pending = new Map<number, Pending>();
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id == null) return;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    });
  }
  send(method: string, params: unknown = {}): Promise<any> {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval<T>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + expression.slice(0, 120));
    return r.result.value as T;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for the art-direction layer to finish arriving.
 *
 * A fixed delay is not enough and the first pass proved it: the display and the
 * lede are DRAWN IN (motion.css §4), and a frame taken 400ms after load caught
 * the lede half-revealed. That reads in the screenshot exactly like a line
 * clipped by the fold, which is a defect the page does not have — the lede's
 * bottom measures 63px above the fold at 1440x900. A review frame that invents
 * a defect is worse than no frame.
 *
 * `getAnimations()` is asked twice with a gap, because the scroll-driven ones
 * are registered when their element is reached, not at load.
 */
async function settle(cdp: Cdp) {
  for (let i = 0; i < 2; i++) {
    await cdp.eval(`Promise.race([
      Promise.allSettled(document.getAnimations()
        .filter(a => a.playState === 'running' && a.effect
                  && !(a.timeline instanceof ScrollTimeline))
        .map(a => a.finished)),
      new Promise(r => setTimeout(r, 3000)),
    ]).then(() => 1)`);
    await sleep(350);
  }
}

async function connect(): Promise<Cdp> {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  return new Cdp(ws);
}

/* ---------------------------------------------------------------- BLIND */

/**
 * 意味を消す。テキストノード単位で、同じ長さのダミーに置き換える。
 * 和文には和文ダミー、欧文には lorem、数字には数字を当てて、
 * 文字幅の分布を大きく変えないようにする。行数の完全一致は目指さない。
 */
const BLIND_SCRIPT = String.raw`
(() => {
  const KANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろ";
  const KANJI = "業務設計実装検証運用管理情報処理基盤構築評価";
  const LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore".split(" ");
  const isCjk = (c) => /[　-ヿ㐀-鿿＀-￯]/.test(c);
  /* Punctuation is kept, and that is load-bearing rather than tidy: 、。・ are
     where a Japanese line is allowed to break. Blinding them away produces a
     paragraph with no break opportunities in it, which does not measure the
     page's composition — it measures a sentence the page will never be given.
     The first BLIND pass replaced ・ (U+30FB, inside the Katakana block) and
     the hero display ran off the right edge for that reason alone. */
  const KEEP = /[、。・「」『』（）〈〉《》【】〔〕：；！？…—～]/;
  let k = 0;
  const cjkRun = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const pool = (k + i) % 5 === 4 ? KANJI : KANA;
      s += pool[(k * 7 + i * 3) % pool.length];
    }
    k++;
    return s;
  };
  const latinRun = (n) => {
    let s = "";
    while (s.length < n) { s += LOREM[(k++) % LOREM.length] + " "; }
    return s.slice(0, n);
  };
  const blind = (t) => {
    // 空白・約物はそのまま残す（改行機会と字送りを壊さないため）
    let out = "";
    let buf = "", bufCjk = false;
    const flush = () => {
      if (!buf) return;
      out += bufCjk ? cjkRun(buf.length) : latinRun(buf.length);
      buf = "";
    };
    for (const ch of t) {
      if (/\s/.test(ch) || KEEP.test(ch)) { flush(); out += ch; continue; }
      if (/[0-9]/.test(ch)) { flush(); out += "0123456789"[(k++) % 10]; continue; }
      if (/[　-〿 -⁯!-/:-@\[-` + "`" + `{-~]/.test(ch)) { flush(); out += ch; continue; }
      const c = isCjk(ch);
      if (buf && c !== bufCjk) flush();
      bufCjk = c; buf += ch;
    }
    flush();
    return out;
  };
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (SKIP.has(n.parentElement?.tagName ?? "")) continue;
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    nodes.push(n);
  }
  let chars = 0;
  for (const n of nodes) { chars += n.nodeValue.length; n.nodeValue = blind(n.nodeValue); }
  return { nodes: nodes.length, chars };
})()
`;

/* --------------------------------------------------------------- capture */

async function captureMode(cdp: Cdp, outDir: string, blind: boolean) {
  await mkdir(outDir, { recursive: true });
  const facts: Record<string, unknown> = {};

  for (const f of FRAMES) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: f.viewport.width,
      height: f.viewport.height,
      deviceScaleFactor: 1,
      mobile: f.viewport.mobile,
    });
    await cdp.send("Page.navigate", { url: BASE + f.path });
    await cdp.eval(`new Promise(r => {
      if (document.readyState === "complete") return r(1);
      addEventListener("load", () => r(1), { once: true });
    })`);
    await cdp.eval(`document.fonts.ready.then(() => 1)`);
    await settle(cdp);

    const before = await cdp.eval<number>(`document.documentElement.scrollHeight`);
    let blindInfo: unknown = null;
    if (blind) {
      blindInfo = await cdp.eval(BLIND_SCRIPT);
      await cdp.eval(`document.fonts.ready.then(() => 1)`);
      await settle(cdp);
    }
    const docH = await cdp.eval<number>(`document.documentElement.scrollHeight`);

    // scroll position は DOM から解決する
    let scrollY = 0;
    if (f.anchor) {
      scrollY = await cdp.eval<number>(`(() => {
        const el = document.querySelector(${JSON.stringify(f.anchor)});
        if (!el) return 0;
        return Math.round(el.getBoundingClientRect().top + window.scrollY);
      })()`);
      await cdp.eval(`window.scrollTo(0, ${scrollY}); 1`);
      await settle(cdp); // scroll 起動の motion が落ち着くまで
    }

    const clip = f.full
      ? { x: 0, y: 0, width: f.viewport.width, height: docH, scale: 1 }
      : { x: 0, y: scrollY, width: f.viewport.width, height: f.viewport.height, scale: 1 };

    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png", clip, captureBeyondViewport: true, fromSurface: true,
    });
    await writeFile(join(outDir, f.name + ".png"), Buffer.from(shot.data, "base64"));

    facts[f.name] = {
      viewport: f.viewport, path: f.path, scrollY,
      docHeight: docH, docHeightBeforeBlind: blind ? before : undefined,
      blindDelta: blind ? +(((docH - before) / before) * 100).toFixed(2) + "%" : undefined,
      blind: blindInfo, size: { w: clip.width, h: clip.height },
    };
    console.log(`  ${blind ? "BLIND" : "REAL "}  ${f.name.padEnd(13)} ${clip.width}x${clip.height} scrollY=${scrollY}`);
  }
  await writeFile(join(outDir, "geometry.json"), JSON.stringify(facts, null, 1));
}

/* ------------------------------------------------------------------ main */

// `tmpdir()` rather than a written-out path: the temp directory is the OS's to
// name, and a literal one is both wrong off Linux and a machine path in a file
// that ships in a public repository (public-safe-scan ABS-TMP).
const profile = join(tmpdir(), `cf-profile-${process.pid}`);
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "about:blank",
], { stdio: "ignore" });

try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); }
  }
  const cdp = await connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log(`capture → ${OUT}`);
  await captureMode(cdp, join(OUT, "real"), false);
  await captureMode(cdp, join(OUT, "blind"), true);
} finally {
  chrome.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
