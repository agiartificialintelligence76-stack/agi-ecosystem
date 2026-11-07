#!/usr/bin/env python3
# HEARTBEAT (2026-11-08): the charts of AGI-1's seven songs, made once from the songs themselves (deterministic: the same
# audio always gives the same charts). Run after encode.py audio:
#
#   python3 tools/games/heartbeat/chart.py [song-id …] [--plots DIR] [--sonify DIR]
#
# → src/games/heartbeat/charts/<id>.json and src/games/heartbeat/charts/index.json
#
# How (numpy, scipy and librosa):
#   1. The game's own copy (public/games/heartbeat/audio/<id>.m4a), decoded by ffmpeg like a browser decodes it.
#   2. Onsets in three bands at 1 ms (zero-phase filters: kick/low, snare/mid, hats/high) and, from a harmonic/percussive
#      split, the melody's onsets, its pitch movement and its sustained notes.
#   3. The beat grid. These songs are generated, and all but one drift: they speed up by 1–6 BPM over their length, so a
#      single BPM would be hundreds of ms off by the end. A tempo curve from 16 s windows (a comb fit each) guides a
#      phase-locked tracker that follows the beat onsets, then a robust smoothing spline gives every beat's time.
#      Downbeats: the kick, the snare and the chord changes of each beat's place in the bar.
#   4. Every 16th between beats is a candidate, scored by what plays there (band onsets, melody onsets, its place in the
#      bar). Each difficulty picks per bar as many as the song's energy asks (quiet intros sparse, choruses dense, breaks
#      where it breathes), scaled to its density target, with its own rules (EASY: beats, singles; NORMAL: 8ths, a few
#      doubles and holds; HARD: 16ths in busy parts, doubles, holds, streams).
#   5. Lanes follow the music: the melody going up moves right, down moves left, kicks lean left and snares right; runs
#      become stairs, trills and rolls; a bar whose rhythm came before repeats or mirrors its lanes; never a same-lane
#      note within 120 ms; holds keep their lane to themselves.
import argparse
import json
import os
import subprocess
import sys

import numpy as np
from scipy import interpolate, ndimage, signal

sys.path.insert(0, os.path.dirname(__file__))
from catalog import SONGS, CHARTS, game_audio, chart_file  # noqa: E402

SR = 22050          # analysis rate
FR = 1000           # onset frames a second (1 ms)
HOP = 512           # harmonic analysis hop (23 ms)
TARGET = {'easy': 1.5, 'normal': 3.0, 'hard': 5.2}     # notes a second, between the first and the last note
RANGE = {'easy': (1.2, 1.8), 'normal': (2.5, 3.5), 'hard': (4.5, 6.0)}
JACK = 0.12         # never two notes in one lane closer than this (s)
PREVIEW = 12.0      # the song select's loop (s)


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


# ---------- onsets ----------

def band_onset(y, lo, hi):
    if lo <= 0:
        sos = signal.butter(4, hi, btype='low', fs=SR, output='sos')
    elif hi >= SR / 2:
        sos = signal.butter(4, lo, btype='high', fs=SR, output='sos')
    else:
        sos = signal.butter(4, [lo, hi], btype='band', fs=SR, output='sos')
    b = signal.sosfiltfilt(sos, y)
    e = b * b
    c = np.concatenate([[0.0], np.cumsum(e)])
    step = SR / FR
    n = int(len(y) / step)
    idx = (np.arange(n) * step).astype(int)
    half = int(0.003 * SR)
    a = np.clip(idx - half, 0, len(e))
    z = np.clip(idx + half, 0, len(e))
    rms = np.sqrt((c[z] - c[a]) / np.maximum(1, z - a))
    level = np.log1p(rms / (np.percentile(rms, 90) + 1e-12) * 20)
    lag = 8
    d = level - np.concatenate([np.full(lag, level[0]), level[:-lag]])
    d[d < 0] = 0
    peak = np.percentile(d[d > 0], 99.5) if np.any(d > 0) else 1.0
    return d / (peak + 1e-12)


def smooth(x, n):
    w = np.hanning(n)
    return np.convolve(x, w / w.sum(), mode='same')


# ---------- the beat grid ----------

def comb_scores(on, T, t0s, start, stop):
    """mean onset at a grid of period T (s) for each phase t0 (s, absolute), between start and stop (s)"""
    ks = np.arange(0, int((stop - start) / T) + 1)
    idx = np.round((t0s[:, None] + ks[None, :] * T) * FR).astype(int)
    ok = (idx >= int(start * FR)) & (idx < min(len(on), int(stop * FR)))
    vals = np.where(ok, on[np.clip(idx, 0, len(on) - 1)], 0.0)
    return vals.sum(axis=1) / np.maximum(1, ok.sum(axis=1))


def global_tempo(on):
    # autocorrelation of a 100 Hz onset curve; prefer 100–175 BPM (these songs' feel)
    x = on[: len(on) // 10 * 10].reshape(-1, 10).max(axis=1)
    x = x - x.mean()
    ac = np.correlate(x, x, mode='full')[len(x) - 1:]
    best, bpm_best = -1e9, 120.0
    for bpm in np.arange(90, 190, 0.25):
        lag = 6000 / bpm
        i = int(lag)
        v = ac[i] + (ac[i + 1] - ac[i]) * (lag - i)
        v2 = ac[int(lag * 2)] if int(lag * 2) < len(ac) else 0
        score = v + 0.5 * v2
        if not 100 <= bpm <= 175:
            score *= 0.8
        if score > best:
            best, bpm_best = score, bpm
    return bpm_best


def tempo_curve(on, dur, g):
    """(centre s, bpm, phase s, contrast) for 16 s windows every 4 s"""
    out = []
    W = 16.0
    starts = np.arange(0, max(0.1, dur - W) + 0.01, 4.0)
    for ws in starts:
        we = min(dur, ws + W)
        seg_mean = on[int(ws * FR):int(we * FR)].mean() + 1e-9
        best = (-1.0, g, ws)
        for bpm in np.arange(g - 7, g + 7.001, 0.05):
            T = 60 / bpm
            t0s = ws + np.arange(0, T, 0.002)
            sc = comb_scores(on, T, t0s, ws, we)
            i = int(sc.argmax())
            if sc[i] > best[0]:
                best = (sc[i], bpm, t0s[i])
        out.append(((ws + we) / 2, best[1], best[2], best[0] / seg_mean))
    return out


def track_beats(on, dur, curve):
    cen = np.array([c[0] for c in curve])
    bpms = np.array([c[1] for c in curve])
    contrast = np.array([c[3] for c in curve])
    # a robust smooth tempo curve: median of 5, then a spline weighted by how clear each window was
    med = ndimage.median_filter(bpms, size=5, mode='nearest')
    if len(cen) >= 4:
        spl = interpolate.UnivariateSpline(cen, med, w=np.sqrt(contrast), k=3, s=len(cen) * 0.15)
        bpm_at = lambda t: float(spl(np.clip(t, cen[0], cen[-1])))   # noqa: E731
    else:
        bpm_at = lambda t: float(np.interp(t, cen, med))   # noqa: E731
    a = int(np.argmax(contrast))
    anchor = curve[a][2]
    sm = smooth(on, 9)

    def walk(t, direction):
        beats = []
        T = 60 / bpm_at(t)
        drift = 0.0
        while 0 <= t <= dur:
            beats.append(t)
            T_nom = 60 / bpm_at(t)
            T = T_nom + drift
            pred = t + direction * T
            lo, hi = int((pred - 0.04) * FR), int((pred + 0.04) * FR)
            if lo < 0 or hi >= len(sm):
                t = pred
                continue
            seg = sm[lo:hi]
            w = np.exp(-0.5 * ((np.arange(lo, hi) / FR - pred) / 0.018) ** 2)
            j = int(np.argmax(seg * w))
            local = sm[max(0, int((pred - 1.5) * FR)):int((pred + 1.5) * FR)]
            ref = np.percentile(local, 97) if len(local) else 0
            if seg[j] > 0.35 * ref and seg[j] > 0.05:
                err = (lo + j) / FR - pred
                t = pred + 0.3 * err
                drift = np.clip(drift + 0.02 * err * direction, -0.01, 0.01)
            else:
                t = pred
                drift *= 0.9
        return beats

    fwd = walk(anchor, +1)
    back = walk(anchor, -1)[1:]
    beats = np.array(sorted(back + fwd))
    beats = beats[(beats >= 0) & (beats <= dur)]
    # robust smoothing spline of time against beat number (the drift is smooth; single beats jitter)
    k = np.arange(len(beats), dtype=float)
    w = np.ones_like(k)
    t_s = beats
    for _ in range(4):
        spl = interpolate.UnivariateSpline(k, beats, w=w, k=3, s=float(w.sum()) * 0.006 ** 2)
        t_s = spl(k)
        res = beats - t_s
        w = 1.0 / np.maximum(1.0, np.abs(res) / 0.02)
    return t_s


def beat_errors(on, beats):
    """each beat's distance to the strongest onset within 40 ms, and that onset's strength (for the report)"""
    sm = smooth(on, 9)
    out = []
    for t in beats:
        lo, hi = int((t - 0.04) * FR), int((t + 0.04) * FR)
        if lo >= 0 and hi < len(sm):
            seg = sm[lo:hi]
            out.append(((lo + int(np.argmax(seg))) / FR - t, float(seg.max())))
    return out


def downbeat_phase(beats, low, mid, high, chroma_at):
    n = len(beats)
    kick = np.zeros(n)
    snare = np.zeros(n)
    nov = np.zeros(n)
    prev = None
    for i, t in enumerate(beats):
        a, z = int((t - 0.03) * FR), int((t + 0.03) * FR)
        a = max(0, a)
        kick[i] = low[a:z].max() if z > a else 0
        snare[i] = (mid[a:z].max() + high[a:z].max()) if z > a else 0
        c = chroma_at(t, beats[i + 1] if i + 1 < n else t + 0.4)
        if prev is not None:
            nov[i] = 1 - float(np.dot(c, prev) / (np.linalg.norm(c) * np.linalg.norm(prev) + 1e-9))
        prev = c
    z = lambda x: (x - x.mean()) / (x.std() + 1e-9)   # noqa: E731
    kz, sz, nz = z(kick), z(snare), z(nov)
    scores = []
    for ph in range(4):
        m = (np.arange(n) - ph) % 4 == 0
        h = (np.arange(n) - ph) % 4 == 2
        two = (np.arange(n) - ph) % 2 == 1
        scores.append(1.0 * nz[m].mean() + 0.6 * kz[m].mean() + 0.3 * kz[h].mean() + 0.5 * sz[two].mean() - 0.3 * sz[m].mean())
    return int(np.argmax(scores)), scores


# ---------- the song's character ----------

class Song:
    KEYS = ('low', 'mid', 'high', 'on', 'ft', 'melraw', 'hdb', 'pitch', 'pconf', 'mspec', 'chroma', 'rdb', 'beats', 'curve')

    def __init__(self, sid, title, cache=None):
        self.id, self.title = sid, title
        path = os.path.join(cache, f'{sid}.npz') if cache else None
        if path and os.path.exists(path) and os.path.getmtime(path) > os.path.getmtime(game_audio(sid)):
            z = np.load(path)
            for k in self.KEYS:
                setattr(self, k, z[k])
            self.dur = float(z['dur'])
        else:
            self.analyse()
            if path:
                os.makedirs(cache, exist_ok=True)
                np.savez_compressed(path, dur=self.dur, **{k: np.asarray(getattr(self, k)) for k in self.KEYS})
        # melody onsets over an adaptive threshold (the local median), so a busy mix doesn't read as one long onset
        base = ndimage.median_filter(self.melraw, size=25, mode='nearest')
        mel = np.maximum(0, self.melraw - 1.1 * base)
        self.mel = mel / (np.percentile(mel[mel > 0], 99) + 1e-12)
        self.mspec = self.mspec.astype(np.float64)
        cen = np.array([c[0] for c in self.curve])
        bpms = np.array([c[1] for c in self.curve])
        self.bpm_at = lambda t: float(np.interp(t, cen, ndimage.median_filter(bpms, size=5, mode='nearest')))
        self.beat_err = beat_errors(self.on, self.beats)
        self.phase, self.phase_scores = downbeat_phase(self.beats, self.low, self.mid, self.high, self.chroma_between)
        self.bpm = float(np.median(60 / np.diff(self.beats)))

    def analyse(self):
        y = decode(game_audio(self.id))
        self.dur = len(y) / SR
        self.low = band_onset(y, 30, 150)
        self.mid = band_onset(y, 150, 2500)
        self.high = band_onset(y, 5000, SR / 2 - 1)
        self.on = smooth(self.low + self.mid + 0.5 * self.high, 7)
        # the harmonic part: melody onsets, pitch, sustain
        import librosa
        S = np.abs(librosa.stft(y.astype(np.float32), n_fft=2048, hop_length=HOP))
        H, P = librosa.decompose.hpss(S, margin=(1.0, 2.0))
        f = librosa.fft_frequencies(sr=SR, n_fft=2048)
        self.ft = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=HOP)
        band = (f >= 150) & (f < 4000)
        LH = np.log1p(50 * H[band] / (H[band].max() + 1e-12))
        flux = np.diff(LH, axis=1, prepend=LH[:, :1])
        flux[flux < 0] = 0
        self.melraw = flux.sum(axis=0)
        eh = (H[band] ** 2).sum(axis=0)
        self.hdb = 10 * np.log10(eh + 1e-12)
        # the predominant pitch: harmonic summation over f0 candidates (90–900 Hz, a third of a semitone apart)
        f0s = 440.0 * 2 ** (np.arange(-48, 12.01, 1 / 3) / 12)
        A = np.sqrt(H)
        sal = np.zeros((len(f0s), H.shape[1]))
        df = f[1] - f[0]
        for h in range(1, 7):
            pos = f0s * h / df
            i0 = np.clip(np.floor(pos).astype(int), 0, len(f) - 2)
            fr = (pos - i0)[:, None]
            sal += 0.8 ** (h - 1) * ((1 - fr) * A[i0] + fr * A[i0 + 1])
        best = sal.argmax(axis=0)
        self.pitch = ndimage.median_filter(12 * np.log2(f0s[best] / 440.0), size=3)
        self.pconf = sal.max(axis=0) / (sal.mean(axis=0) + 1e-9)
        # a coarse log-frequency picture of the harmonic part (sustained notes: it stays the same)
        M = librosa.feature.melspectrogram(S=H ** 2, sr=SR, n_mels=40, fmin=150, fmax=4000)
        M = np.log1p(M / (M.max() + 1e-12) * 1000)
        M = M / (np.linalg.norm(M, axis=0, keepdims=True) + 1e-9)
        self.mspec = M.astype(np.float16)
        self.chroma = librosa.feature.chroma_stft(S=H ** 2, sr=SR, hop_length=HOP)
        rms = librosa.feature.rms(y=y.astype(np.float32), frame_length=2048, hop_length=HOP)[0]
        self.rdb = 20 * np.log10(rms + 1e-9)
        # the beat grid
        g = global_tempo(self.on)
        self.curve = np.array(tempo_curve(self.on, self.dur, g))
        self.beats = track_beats(self.on, self.dur, self.curve)

    def frame(self, t):
        return int(np.clip(round(t * SR / HOP), 0, len(self.ft) - 1))

    def chroma_between(self, a, b):
        i, j = self.frame(a), max(self.frame(a) + 1, self.frame(b))
        return self.chroma[:, i:j].mean(axis=1)

    def peak(self, x, t, w=0.025):
        a, z = max(0, int((t - w) * FR)), int((t + w) * FR)
        return float(x[a:z].max()) if z > a else 0.0

    def mel_at(self, t):
        i = self.frame(t)
        return float(self.mel[max(0, i - 1):i + 2].max())


# ---------- candidates ----------

def grid(song):
    """every 16th between beats: (time, level 0 beat / 1 8th / 2 16th, beat index, step within the beat)"""
    out = []
    b = song.beats
    for k in range(len(b) - 1):
        for j in range(4):
            t = b[k] + (b[k + 1] - b[k]) * j / 4
            level = 0 if j == 0 else (1 if j == 2 else 2)
            out.append((t, level, k, j))
    out.append((b[-1], 0, len(b) - 1, 0))
    return out


def features(song, cands):
    n = len(cands)
    F = {k: np.zeros(n) for k in ('low', 'mid', 'high', 'mel', 'pitch', 'energy', 'sustain')}
    # section energy: loudness over ~2 bars, mapped to 0..1 between the song's quiet and loud parts
    win = max(1, int(round(4 * 60 / song.bpm * SR / HOP)))
    loud = ndimage.uniform_filter1d(song.rdb, win)
    lo, hi = np.percentile(loud, 8), np.percentile(loud, 97)
    for i, (t, level, k, j) in enumerate(cands):
        F['low'][i] = song.peak(song.low, t)
        F['mid'][i] = song.peak(song.mid, t)
        F['high'][i] = song.peak(song.high, t)
        F['mel'][i] = song.mel_at(t)
        a, z = song.frame(t + 0.03), song.frame(t + 0.15) + 1
        F['pitch'][i] = float(np.median(song.pitch[a:z]))
        F['energy'][i] = np.clip((loud[song.frame(t)] - lo) / (hi - lo + 1e-9), 0, 1)
    # sustain: how long (s) the predominant pitch holds (within a semitone) after the onset, loud enough and with no
    # new strong melody onset: a held vocal or synth note
    hd = song.hdb
    P = ndimage.median_filter(song.pitch, size=5)
    for i, (t, level, k, j) in enumerate(cands):
        a = song.frame(t + 0.06)
        ref, lvl = P[a], hd[a]
        z = a + 1
        limit = min(len(song.ft) - 1, song.frame(t + 3.0))
        while z < limit and abs(P[z] - ref) <= 1.0 and hd[z] > lvl - 8 and song.mel[z] < 0.6:
            z += 1
        F['sustain'][i] = song.ft[min(z, len(song.ft) - 1)] - t
    return F


def salience(F, cands, song):
    n = len(cands)
    s = np.zeros(n)
    for i, (t, level, k, j) in enumerate(cands):
        drum = max(1.0 * F['low'][i], 0.85 * F['mid'][i], 0.55 * F['high'][i])
        v = max(drum, 0.95 * F['mel'][i])
        bar_pos = (k - song.phase) % 4
        bonus = (0.22 if level == 0 else 0.08 if level == 1 else 0.0)
        if level == 0 and bar_pos == 0:
            bonus += 0.08
        s[i] = v + bonus
    return s


# ---------- picking the notes ----------

RULES = {
    # level: the finest place allowed (0 beats, 1 8ths, 2 16ths); space: min 16ths between notes; lo/hi/gamma: notes a
    # second against the section's energy (0..1), before the song-wide scaling; eighth/sixteenth: what a weaker place
    # costs in the bar's ranking
    'easy': dict(level=1, space=4, lo=0.45, hi=1.0, gamma=1.3, eighth=0.30, sixteenth=9),
    'normal': dict(level=1, space=2, lo=0.40, hi=1.0, gamma=1.2, eighth=0.02, sixteenth=9),
    'hard': dict(level=2, space=1, lo=0.40, hi=1.0, gamma=1.0, eighth=0.0, sixteenth=0.08),
}


def bars_of(song, cands):
    bars = {}
    for i, (t, level, k, j) in enumerate(cands):
        bars.setdefault((k - song.phase) // 4, []).append(i)
    return bars


def pick(song, cands, F, S, diff, mult, bars):
    r = RULES[diff]
    chosen = []
    hist = []
    for bar in sorted(bars):
        idx = bars[bar]
        t0 = cands[idx[0]][0]
        t1 = cands[idx[-1]][0] + (cands[idx[-1]][0] - cands[idx[0]][0]) / max(1, len(idx) - 1)
        E = float(np.mean([F['energy'][i] for i in idx]))
        loudest = max(S[i] for i in idx)
        prev = np.mean(hist[-2:]) if hist else E
        hist.append(E)
        if loudest < 0.3:
            continue                                    # nothing playing: a rest
        rate = mult * (r['lo'] + (r['hi'] - r['lo']) * E ** r['gamma'])
        want = int(round(rate * (t1 - t0)))
        if prev > 0.45 and E < 0.55 * prev:
            want = min(want, 2)                         # the song takes a breath
        pool = []
        for i in idx:
            t, level, k, j = cands[i]
            if level > r['level'] or S[i] < 0.2:
                continue
            sc = S[i] - (r['eighth'] if level == 1 else r['sixteenth'] if level == 2 else 0)
            pool.append((sc, i))
        pool.sort(key=lambda x: (-x[0], x[1]))
        taken = []
        for sc, i in pool:
            if len(taken) >= want:
                break
            if all(abs(i - o) >= r['space'] for o in taken) and (not chosen or i - chosen[-1] >= r['space']):
                taken.append(i)
        chosen.extend(sorted(taken))
    return chosen


def density(times):
    if len(times) < 2:
        return 0.0
    return len(times) / (times[-1] - times[0])


def pick_scaled(song, cands, F, S, diff, bars, target):
    lo, hi = 0.2, 14.0
    best = None
    for _ in range(40):
        mid = (lo + hi) / 2
        ch = pick(song, cands, F, S, diff, mid, bars)
        d = density([cands[i][0] for i in ch])
        if best is None or abs(d - target) < abs(best[1] - target):
            best = (ch, d, mid)
        if abs(d - target) < 0.015:
            break
        if d < target:
            lo = mid
        else:
            hi = mid
    return best


# ---------- holds and doubles ----------

def choose_holds(song, cands, F, chosen, diff):
    """{grid index: hold seconds}. Held vocal or synth notes become holds; while one is held, the other hand keeps
    playing (thinned: beats on NORMAL, up to 8ths on HARD) and there are no doubles."""
    if diff == 'easy':
        return {}, chosen
    min_beats = 1.0 if diff == 'normal' else 0.75
    gap_bars = 5 if diff == 'normal' else 3
    cand = []
    for g in chosen:
        t, level, k, j = cands[g]
        if level == 2 or F['mel'][g] < 0.2 or F['energy'][g] < 0.08:
            continue
        beat = (song.beats[min(k + 1, len(song.beats) - 1)] - song.beats[k]) or 60 / song.bpm
        sb = F['sustain'][g] / beat
        if sb >= min_beats:
            cand.append((sb * (0.6 + F['mel'][g]), g, sb))
    cand.sort(key=lambda x: (-x[0], x[1]))
    holds = {}
    used_bars = []
    for _, g, sb in cand:
        t, level, k, j = cands[g]
        bar = (k - song.phase) // 4
        if any(abs(bar - b) < gap_bars for b in used_bars):
            continue
        steps = int(min(sb, 4.0) * 2)                   # 8ths, at most 4 beats
        end_i = g + steps * 2
        if end_i >= len(cands):
            continue
        dur = cands[end_i][0] - t
        if dur < 0.4:
            continue
        holds[g] = round(dur, 3)
        used_bars.append(bar)
    # thin what's under each hold
    keep = []
    spans = sorted((g, g + int(round(holds[g] / ((song.beats[min(cands[g][2] + 1, len(song.beats) - 1)] - song.beats[cands[g][2]]) / 4)))) for g in holds)
    for g in chosen:
        inside = any(a < g <= z + 1 for a, z in spans)
        lvl = cands[g][1]
        if inside and (lvl > (0 if diff == 'normal' else 1)):
            continue
        keep.append(g)
    return holds, keep


def hold_spans(cands, holds):
    return [(cands[g][0], cands[g][0] + h) for g, h in holds.items()]


def choose_doubles(song, cands, F, chosen, diff, holds):
    if diff == 'easy':
        return set()
    spans = hold_spans(cands, holds)
    out = set()
    every = 4 if diff == 'normal' else 1
    last_bar = -99
    prev_e = 0.0
    for g in chosen:
        t, level, k, j = cands[g]
        E = F['energy'][g]
        jump = E - prev_e > 0.2
        prev_e = 0.8 * prev_e + 0.2 * E
        if g in holds or any(a - 0.05 <= t <= z + 0.05 for a, z in spans):
            continue
        bar = (k - song.phase) // 4
        pos = (k - song.phase) % 4
        hit = F['low'][g] + F['high'][g]
        if level != 0:
            continue
        if diff == 'normal':
            if pos == 0 and E > 0.5 and hit > 0.9 and (bar - last_bar >= every or (jump and bar - last_bar >= 2)):
                out.add(g)
                last_bar = bar
        elif pos in (0, 2) and E > 0.45 and hit > 0.85 and bar - last_bar >= every:
            out.add(g)
            last_bar = bar
    return out


# ---------- lanes ----------

PAIRS = [(0, 3), (1, 2), (0, 2), (1, 3)]


def note_kind(F, g):
    drum = max(F['low'][g], 0.9 * F['mid'][g], 0.6 * F['high'][g])
    if F['mel'][g] >= 0.75 * drum:
        return 'mel'
    if F['low'][g] >= max(F['mid'][g], F['high'][g]):
        return 'kick'
    return 'snare'


def lanes_for(song, cands, F, chosen, diff, holds, doubles):
    """→ [(time, [lanes], hold seconds)]: the melody moves the lanes (up → right, down ← left), kicks lean left and
    snares right, fast runs alternate hands as stairs and trills, a bar heard before repeats or mirrors its lanes."""
    out = []
    lane_free = [-9.0] * 4          # free from this time (after a hold)
    lane_last = [-9.0] * 4          # its last note
    use = [0] * 4
    L, L2 = 1, 2                    # the last two lanes
    t_prev, p_prev = -9.0, None
    step_prev = 0
    recent = []                     # the last four single notes' lanes
    memory = {}
    bars = {}
    for g in chosen:
        bars.setdefault((cands[g][2] - song.phase) // 4, []).append(g)

    def free(c, t):
        return lane_free[c] <= t + 1e-6 and t - lane_last[c] >= JACK

    def place(c, t, hold=0.0):
        lane_last[c] = t + hold
        if hold:
            lane_free[c] = t + hold + 0.06
        use[c] += 1

    for bar in sorted(bars):
        gs = bars[bar]
        k0 = song.phase + bar * 4
        sig = tuple(((cands[g][2] - k0) * 4 + cands[g][3], g in doubles, g in holds) for g in gs)
        contour, pp = [], None
        for g in gs:
            p = F['pitch'][g]
            contour.append(0 if pp is None else int(np.clip(round((p - pp) / 2), -1, 1)))
            pp = p
        key = (sig, tuple(contour))
        plan = None
        if key in memory and diff != 'easy' and len(gs) >= 3:
            prev_lanes, count = memory[key]
            order = [[3 - x for x in prev_lanes], prev_lanes] if count % 2 else [prev_lanes, [3 - x for x in prev_lanes]]
            for variant in order:
                if all(free(c, cands[g][0]) for g, c in zip(gs, variant) if g not in doubles):
                    plan = variant
                    break
        lanes_here = []
        for n_i, g in enumerate(gs):
            t, level, k, j = cands[g]
            hold = holds.get(g, 0.0)
            dt = t - t_prev
            if g in doubles:
                pair = None
                for pi in range(4):
                    cand_pair = PAIRS[(bar + pi) % 4]
                    if all(free(c, t) for c in cand_pair) and not (dt < 0.25 and L in cand_pair):
                        pair = cand_pair
                        break
                if pair is None:
                    for cand_pair in PAIRS:
                        if all(free(c, t) for c in cand_pair):
                            pair = cand_pair
                            break
                if pair is not None:
                    for c in pair:
                        place(c, t)
                    out.append((t, list(pair), 0.0))
                    lanes_here.append(pair[0])
                    L2, L = L, (pair[1] if step_prev >= 0 else pair[0])
                    t_prev, p_prev = t, F['pitch'][g]
                    continue
            p = F['pitch'][g]
            dp = 0.0 if (p_prev is None or dt > 1.6) else p - p_prev
            kind = note_kind(F, g)
            if plan is not None and free(plan[n_i], t):
                c = plan[n_i]
            else:
                best, c = -1e9, None
                for cand in range(4):
                    if not free(cand, t):
                        continue
                    d = cand - L
                    sc = 0.0
                    if abs(dp) >= 0.8:
                        want = 1 if dp > 0 else -1
                        if d * want > 0:
                            sc += 1.2 + (0.4 if (abs(d) == 2) == (abs(dp) >= 4) else 0)
                        elif d == 0:
                            sc -= 0.6
                        else:
                            sc -= 1.0
                    else:
                        if d == 0:
                            sc += 0.7 if dt >= 0.3 else -0.5
                            if L == L2:
                                sc -= 2.0
                        elif cand == L2 and dt < 0.3:
                            sc += 0.6                    # a trill
                        elif abs(d) == 1:
                            sc += 0.3
                    if kind == 'kick':
                        sc += 0.5 if cand <= 1 else 0
                    elif kind == 'snare':
                        sc += 0.5 if cand >= 2 else 0
                    if dt < 0.17:
                        sc += 1.0 if cand // 2 != L // 2 else -0.8
                        if d != 0 and d == L - L2 and abs(d) == 1:
                            sc += 0.5                    # stairs keep going
                    if dt < 0.26:
                        # no anchors: a lane already used twice in the last four fast notes is a weaker choice
                        sc -= 0.45 * max(0, recent.count(cand) - 1)
                    if abs(d) == 3:
                        sc -= 0.2 if dt >= 0.4 else 0.7
                    elif abs(d) == 2:
                        sc -= 0.1
                    if diff == 'easy' and abs(d) >= 2:
                        sc -= 0.4
                    sc -= 0.04 * (use[cand] - sum(use) / 4)
                    sc += 0.001 * ((cand * 7 + bar * 3 + n_i) % 5)     # a fixed, fair tie-break
                    if sc > best:
                        best, c = sc, cand
                if c is None:
                    continue                            # nowhere free: dropped
            place(c, t, hold)
            out.append((t, [c], hold))
            recent.append(c)
            del recent[:-4]
            lanes_here.append(c)
            step_prev = c - L
            L2, L = L, c
            t_prev, p_prev = t, p
        if len(lanes_here) == len(gs):
            prev = memory.get(key)
            memory[key] = (lanes_here if prev is None else prev[0], (prev[1] + 1) if prev else 1)
    return out


# ---------- the whole chart ----------

def song_target(song, F, diff):
    """a song's notes a second for a difficulty: faster and busier songs ask a little more (within its range)"""
    busy = float(np.mean(F['energy'] >= 0.6))
    lo, hi = RANGE[diff]
    t = TARGET[diff] * (song.bpm / 132) ** 0.9 * (0.9 + 0.2 * busy)
    return float(np.clip(t, lo + 0.08, hi - 0.1))


def make_chart(song, cands, F, S, diff):
    bars = bars_of(song, cands)
    goal = song_target(song, F, diff)
    target = goal
    for _ in range(4):
        chosen, d, mult = pick_scaled(song, cands, F, S, diff, bars, target)
        holds, chosen = choose_holds(song, cands, F, chosen, diff)
        doubles = choose_doubles(song, cands, F, chosen, diff, holds)
        notes = lanes_for(song, cands, F, chosen, diff, holds, doubles)
        heads = sorted(set(round(t, 3) for t, _, _ in notes))
        real = density(heads)
        if abs(real - goal) < 0.06:
            break
        target += goal - real                           # thinning under holds: ask for a little more
    out = []
    for t, lanes, hold in notes:
        for l in lanes:
            out.append([round(float(t), 3), int(l)] + ([round(float(hold), 3)] if hold > 0 else []))
    out.sort(key=lambda n: (n[0], n[1]))
    return out, mult


def lane_stats(chart):
    heads = {}
    for n in chart:
        heads.setdefault(n[0], []).append(n[1])
    singles = [(t, ls[0]) for t, ls in sorted(heads.items()) if len(ls) == 1]
    use = np.bincount([n[1] for n in chart], minlength=4) / len(chart)
    same = fast = alt = 0
    jumps = np.zeros(4)
    for (t0, a), (t1, b) in zip(singles, singles[1:]):
        jumps[abs(b - a)] += 1
        same += a == b
        if t1 - t0 < 0.17:
            fast += 1
            alt += (a // 2) != (b // 2)
    return use, jumps / max(1, jumps.sum()), same / max(1, len(singles) - 1), (alt / fast if fast else 1.0)


def check(chart, diff, dur):
    problems = []
    last = {}
    free = {}
    for n in chart:
        t, l = n[0], n[1]
        h = n[2] if len(n) > 2 else 0
        if not 0 <= l <= 3:
            problems.append(f'lane {l}')
        if t < 0 or t + h > dur:
            problems.append(f'time {t}')
        if l in last and t - last[l] < JACK - 1e-6:
            problems.append(f'jack {t} lane {l}')
        if l in free and t < free[l]:
            problems.append(f'in a hold {t} lane {l}')
        last[l] = t + h
        if h:
            free[l] = t + h
    heads = sorted(set(n[0] for n in chart))
    chords = len(chart) - len(heads)
    lo, hi = RANGE[diff]
    d = density(heads)
    if not lo <= d <= hi:
        problems.append(f'density {d:.2f}')
    if diff == 'easy' and chords:
        problems.append('chords on easy')
    return problems, d, chords


def preview_range(song, cands, F):
    # the loudest 12 s that start on a downbeat, in the first three quarters (the first chorus, usually)
    best, best_t = -np.inf, 0.0
    downs = [song.beats[k] for k in range(song.phase, len(song.beats), 4)]
    for t in downs:
        if t + PREVIEW > song.dur * 0.78 or t < 8:
            continue
        a, z = song.frame(t), song.frame(t + PREVIEW)
        v = float(np.mean(song.rdb[a:z]))
        if v > best:
            best, best_t = v, t
    return [round(best_t, 3), round(best_t + PREVIEW, 3)]


def energy_string(song, F, cands):
    # one digit per beat, 0–9: the visuals' energy (the stage, the demo's equalizer)
    out = []
    by_k = {}
    for i, (t, level, k, j) in enumerate(cands):
        by_k.setdefault(k, []).append(F['energy'][i])
    for k in range(len(song.beats)):
        v = np.mean(by_k.get(k, [0]))
        out.append(str(int(np.clip(round(v * 9), 0, 9))))
    return ''.join(out)


def build(sid, title, plots=None, sonify=None, cache=None):
    song = Song(sid, title, cache)
    cands = grid(song)
    F = features(song, cands)
    S = salience(F, cands, song)
    errs = np.array([e for e, s in song.beat_err if s > 0.3])
    print(f'{sid}: {song.dur:.1f}s, {len(song.beats)} beats, {song.bpm:.2f} BPM (from {60 / np.diff(song.beats[:16]).mean():.2f} '
          f'to {60 / np.diff(song.beats[-16:]).mean():.2f}), downbeat phase {song.phase}, beats on an onset: '
          f'{np.mean(np.abs(errs) < 0.015) * 100:.0f}% within 15 ms, median |err| {np.median(np.abs(errs)) * 1000:.1f} ms')
    charts = {}
    for diff in ('easy', 'normal', 'hard'):
        chart, mult = make_chart(song, cands, F, S, diff)
        problems, d, chords = check(chart, diff, song.dur)
        holds = sum(1 for n in chart if len(n) > 2)
        use, jumps, same, alt = lane_stats(chart)
        print(f'   {diff:6s} {len(chart):4d} notes, {d:.2f}/s (x{mult:.2f}), {chords} doubles, {holds} holds, lanes '
              f'{"/".join(f"{u * 100:.0f}" for u in use)}%, moves 0/1/2/3 {"/".join(f"{j * 100:.0f}" for j in jumps)}%, '
              f'fast hand swaps {alt * 100:.0f}%' + (f'  PROBLEMS: {problems[:6]}' if problems else ''))
        charts[diff] = chart
    data = {
        'id': sid, 'title': title, 'bpm': round(song.bpm, 2),
        'offset': round(float(song.beats[song.phase]), 3),
        'duration': round(song.dur, 3),
        'preview': preview_range(song, cands, F),
        'beats': [round(float(b), 3) for b in song.beats],
        'bar': song.phase,
        'energy': energy_string(song, F, cands),
        'charts': charts,
    }
    with open(chart_file(sid), 'w', encoding='utf8') as f:
        json.dump(data, f, separators=(',', ':'))
    if plots:
        plot(song, cands, F, S, data, plots)
    if sonify:
        sonify_chart(song, data, sonify)
    return data


# ---------- checks a person can look at and listen to ----------

def plot(song, cands, F, S, data, outdir):
    from PIL import Image, ImageDraw
    os.makedirs(outdir, exist_ok=True)
    W, H = 1600, 760
    colors = [(255, 77, 166), (255, 201, 51), (63, 240, 195), (139, 102, 255)]
    # windows: early, the preview, late
    p0 = data['preview'][0]
    for name, a in (('intro', 4.0), ('chorus', p0), ('late', song.dur * 0.8)):
        b = a + 6.0
        im = Image.new('RGB', (W, H), (16, 8, 38))
        d = ImageDraw.Draw(im)
        X = lambda t: int((t - a) / (b - a) * W)   # noqa: E731
        for row, (x, col) in enumerate(((song.low, (255, 120, 120)), (song.mid, (255, 220, 120)), (song.high, (120, 220, 255)))):
            base = 140 + row * 110
            seg = x[int(a * FR):int(b * FR)]
            for i in range(0, len(seg), 2):
                v = min(1.0, seg[i])
                d.line([(X(a + i / FR), base), (X(a + i / FR), base - int(v * 100))], fill=col)
        for t in song.beats:
            if a <= t <= b:
                k = int(np.argmin(np.abs(song.beats - t)))
                down = (k - song.phase) % 4 == 0
                d.line([(X(t), 20), (X(t), H)], fill=(255, 255, 255) if down else (110, 100, 150), width=2 if down else 1)
        for di, diff in enumerate(('easy', 'normal', 'hard')):
            base = 420 + di * 110
            d.text((6, base - 8), diff, fill=(220, 220, 220))
            for n in data['charts'][diff]:
                t, l = n[0], n[1]
                if a <= t <= b:
                    y = base + (l - 1.5) * 20
                    if len(n) > 2:
                        d.rectangle([X(t), y - 4, X(min(b, t + n[2])), y + 4], fill=tuple(c // 2 for c in colors[l]))
                    d.ellipse([X(t) - 6, y - 6, X(t) + 6, y + 6], fill=colors[l])
        d.text((6, 4), f'{song.id} {name} {a:.1f}-{b:.1f}s  low/mid/high onsets, beats (white = downbeat), easy/normal/hard', fill=(255, 255, 255))
        im.save(os.path.join(outdir, f'{song.id}-{name}.png'))
    # the whole song: energy and notes a second per difficulty
    im = Image.new('RGB', (W, 300), (16, 8, 38))
    d = ImageDraw.Draw(im)
    X = lambda t: int(t / song.dur * W)   # noqa: E731
    en = data['energy']
    for k, ch in enumerate(en):
        t = song.beats[k]
        d.line([(X(t), 290), (X(t), 290 - int(ch) * 12)], fill=(90, 70, 150))
    for di, (diff, col) in enumerate((('easy', (63, 240, 195)), ('normal', (255, 201, 51)), ('hard', (255, 77, 166)))):
        ts = np.array(sorted(set(n[0] for n in data['charts'][diff])))
        pts = []
        for x in range(0, W, 8):
            t = x / W * song.dur
            c = np.sum((ts >= t - 2) & (ts < t + 2)) / 4
            pts.append((x, 290 - int(c * 22)))
        d.line(pts, fill=col, width=2)
    d.text((6, 4), f'{song.id}: energy (bars) and notes/s: easy mint, normal honey, hard pink', fill=(255, 255, 255))
    im.save(os.path.join(outdir, f'{song.id}-density.png'))


def sonify_chart(song, data, outdir, diff='normal'):
    os.makedirs(outdir, exist_ok=True)
    sr = 44100
    n = int(song.dur * sr) + sr
    click = np.zeros(n, dtype=np.float32)
    blip = (np.sin(2 * np.pi * 2400 * np.arange(int(0.012 * sr)) / sr) * np.exp(-np.arange(int(0.012 * sr)) / (0.003 * sr))).astype(np.float32)
    for note in data['charts'][diff]:
        i = int(note[0] * sr)
        click[i:i + len(blip)] += blip * 0.5
    wav = os.path.join(outdir, f'{song.id}-{diff}-clicks.f32')
    click.tofile(wav)
    out = os.path.join(outdir, f'{song.id}-{diff}-clicks.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', game_audio(song.id), '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', wav,
                    '-filter_complex', '[0:a]volume=0.7[a];[1:a]aformat=channel_layouts=stereo[b];[a][b]amix=inputs=2:normalize=0',
                    '-b:a', '128k', out], check=True)
    os.remove(wav)


def level_of(rows):
    """how hard a chart feels, 1–12 (the same sum as levelOf in src/games/heartbeat/chart.js)"""
    heads = sorted(set(r[0] for r in rows))
    if not heads:
        return 1
    peak, j = 0.0, 0
    for i in range(len(heads)):
        while heads[j] < heads[i] - 8:
            j += 1
        peak = max(peak, (i - j + 1) / 8)
    avg = density(heads)
    chords = len(rows) - len(heads)
    holds = sum(1 for r in rows if len(r) > 2 and r[2] > 0)
    v = 1.6 * avg + 0.35 * peak + (chords + holds) / max(1, len(heads)) * 6 - 1.0
    return int(max(1, min(12, np.floor(v + 0.5))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('songs', nargs='*')
    ap.add_argument('--plots')
    ap.add_argument('--sonify')
    ap.add_argument('--cache', help='keep each song\'s analysis here (faster reruns)')
    a = ap.parse_args()
    os.makedirs(CHARTS, exist_ok=True)
    todo = [(s, t) for s, t in SONGS if not a.songs or s in a.songs]
    for sid, title in todo:
        build(sid, title, a.plots, a.sonify, a.cache)
    # the song select's list: every song, from its chart file
    index = []
    for sid, title in SONGS:
        p = chart_file(sid)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf8') as f:
            d = json.load(f)
        counts = {k: len(v) for k, v in d['charts'].items()}
        levels = {k: level_of(v) for k, v in d['charts'].items()}
        nps = {k: round(density(sorted(set(n[0] for n in v))), 2) for k, v in d['charts'].items()}
        index.append({'id': sid, 'title': d['title'], 'bpm': d['bpm'], 'duration': d['duration'], 'preview': d['preview'],
                      'notes': counts, 'nps': nps, 'levels': levels})
    with open(os.path.join(CHARTS, 'index.json'), 'w', encoding='utf8') as f:
        json.dump(index, f, separators=(',', ':'))


if __name__ == '__main__':
    main()
