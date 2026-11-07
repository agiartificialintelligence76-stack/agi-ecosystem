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
    strength = []

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
    # the beats' own onset peaks (for the report)
    for t in t_s:
        lo, hi = int((t - 0.04) * FR), int((t + 0.04) * FR)
        if lo >= 0 and hi < len(sm):
            seg = sm[lo:hi]
            strength.append(((lo + int(np.argmax(seg))) / FR - t, float(seg.max())))
    return t_s, bpm_at, strength


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
    def __init__(self, sid, title):
        self.id, self.title = sid, title
        y = decode(game_audio(sid))
        self.y = y
        self.dur = len(y) / SR
        self.low = band_onset(y, 30, 150)
        self.mid = band_onset(y, 150, 2500)
        self.high = band_onset(y, 5000, SR / 2 - 1)
        on = self.low + self.mid + 0.5 * self.high
        self.on = smooth(on, 7)
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
        mel = flux.sum(axis=0)
        self.mel = mel / (np.percentile(mel, 99.5) + 1e-12)
        eh = (H[band] ** 2).sum(axis=0)
        self.hdb = 10 * np.log10(eh + 1e-12)
        pb = (f >= 120) & (f < 1500)
        Hp = H[pb] ** 2
        semis = 12 * np.log2(f[pb] / 440.0)
        self.pitch = ndimage.uniform_filter1d((Hp * semis[:, None]).sum(0) / (Hp.sum(0) + 1e-12), 3)
        self.chroma = librosa.feature.chroma_stft(S=H ** 2, sr=SR, hop_length=HOP)
        rms = librosa.feature.rms(y=y.astype(np.float32), frame_length=2048, hop_length=HOP)[0]
        self.rdb = 20 * np.log10(rms + 1e-9)
        # the beat grid
        g = global_tempo(self.on)
        curve = tempo_curve(self.on, self.dur, g)
        self.curve = curve
        self.beats, self.bpm_at, self.beat_err = track_beats(self.on, self.dur, curve)
        self.phase, self.phase_scores = downbeat_phase(self.beats, self.low, self.mid, self.high, self.chroma_between)
        self.bpm = float(np.median(60 / np.diff(self.beats)))

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
        fi = song.frame(t + 0.06)
        F['pitch'][i] = song.pitch[fi]
        F['energy'][i] = np.clip((loud[song.frame(t)] - lo) / (hi - lo + 1e-9), 0, 1)
    # sustain: how long (s) the harmonic level stays within 6 dB of its level just after the onset, with no new strong
    # melody onset (a held vocal or synth note)
    hd = ndimage.uniform_filter1d(song.hdb, 3)
    for i, (t, level, k, j) in enumerate(cands):
        a = song.frame(t + 0.05)
        ref = hd[a]
        z = a + 1
        limit = song.frame(t + 3.0)
        while z < limit and hd[z] > ref - 6 and song.mel[z] < 0.45:
            z += 1
        F['sustain'][i] = song.ft[z] - t if z < len(song.ft) else 0
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
    # max level (0 beats, 1 8ths, 2 16ths), min spacing in 16ths, density curve (low, high) before scaling, its shape
    'easy': dict(level=1, space=4, lo=0.35, hi=1.0, gamma=1.3, eighth=0.30, sixteenth=9),
    'normal': dict(level=1, space=2, lo=0.30, hi=1.0, gamma=1.2, eighth=0.0, sixteenth=9),
    'hard': dict(level=2, space=1, lo=0.32, hi=1.0, gamma=1.0, eighth=0.0, sixteenth=0.06),
}


def pick(song, cands, F, S, diff, mult):
    r = RULES[diff]
    bars = {}
    for i, (t, level, k, j) in enumerate(cands):
        bar = (k - song.phase) // 4
        bars.setdefault(bar, []).append(i)
    chosen = []
    last_t = -9
    for bar in sorted(bars):
        idx = bars[bar]
        t0 = cands[idx[0]][0]
        t1 = cands[idx[-1]][0] + (cands[idx[-1]][0] - cands[idx[0]][0]) / max(1, len(idx) - 1)
        E = float(np.mean([F['energy'][i] for i in idx]))
        loudest = max(S[i] for i in idx)
        if E < 0.06 or loudest < 0.18:
            continue                                    # the song breathes (or is silent): a rest
        rate = mult * (r['lo'] + (r['hi'] - r['lo']) * E ** r['gamma'])
        want = int(round(rate * (t1 - t0)))
        # the bar's candidates by score (penalties for weaker metrical places)
        pool = []
        for i in idx:
            t, level, k, j = cands[i]
            if level > r['level']:
                continue
            sc = S[i]
            if level == 1:
                sc -= r['eighth']
            if level == 2:
                sc -= r['sixteenth']
            if S[i] < 0.12:
                continue
            pool.append((sc, i))
        pool.sort(key=lambda x: (-x[0], x[1]))
        taken = []
        for sc, i in pool:
            if len(taken) >= want:
                break
            gi = i
            ok = all(abs(gi - o) >= r['space'] for o in taken)
            if ok and taken == [] and chosen:
                ok = gi - chosen[-1] >= r['space']
            if ok:
                taken.append(gi)
        taken.sort()
        if chosen and taken and taken[0] - chosen[-1] < r['space']:
            taken = taken[1:]
        chosen.extend(taken)
        last_t = cands[chosen[-1]][0] if chosen else last_t
    return chosen


def density(times):
    if len(times) < 2:
        return 0.0
    return len(times) / (times[-1] - times[0])


def pick_scaled(song, cands, F, S, diff):
    lo, hi = 0.2, 12.0
    best = None
    for _ in range(40):
        mid = (lo + hi) / 2
        ch = pick(song, cands, F, S, diff, mid)
        d = density([cands[i][0] for i in ch])
        best = (ch, d, mid)
        if abs(d - TARGET[diff]) < 0.02:
            break
        if d < TARGET[diff]:
            lo = mid
        else:
            hi = mid
    return best


# ---------- lanes ----------

PAIRS = [(0, 3), (1, 2), (0, 2), (1, 3)]


def lanes_for(song, cands, F, S, chosen, diff, holds, doubles):
    """→ list of (time, [lanes], hold seconds)"""
    notes = []
    last_lane = 1
    last_t = -9.0
    last_pitch = None
    lane_free = [-9.0] * 4          # a lane is free from this time (a hold keeps it)
    lane_last = [-9.0] * 4          # when each lane last had a note
    zig = 1
    repeat = 0
    memory = {}                     # a bar's rhythm → its lanes, how many times it came
    bar_notes = {}
    for gi in chosen:
        t, level, k, j = cands[gi]
        bar = (k - song.phase) // 4
        bar_notes.setdefault(bar, []).append(gi)
    run_dir = 1

    def usable(lane, t):
        return lane_free[lane] <= t and t - lane_last[lane] >= JACK

    for bar in sorted(bar_notes):
        gis = bar_notes[bar]
        start_k = song.phase + bar * 4
        sig = tuple(((cands[g][2] - start_k) * 4 + cands[g][3], g in doubles, g in holds) for g in gis)
        contour = []
        prev_p = None
        for g in gis:
            p = F['pitch'][g]
            contour.append(0 if prev_p is None else int(np.sign(round((p - prev_p) / 1.5))))
            prev_p = p
        key = (sig, tuple(contour))
        reuse = None
        if key in memory and diff != 'easy':
            lanes_prev, count = memory[key]
            for variant in ([3 - l for l in lanes_prev], lanes_prev) if count % 2 else (lanes_prev, [3 - l for l in lanes_prev]):
                ok = True
                for g, l in zip(gis, variant):
                    if not usable(l, cands[g][0]):
                        ok = False
                        break
                if ok:
                    reuse = variant
                    break
        bar_lanes = []
        for n_i, g in enumerate(gis):
            t, level, k, j = cands[g]
            hold = holds.get(g, 0.0)
            if g in doubles:
                choice = None
                for pi in range(4):
                    pair = PAIRS[(bar + pi + (k % 2)) % 4]
                    if all(usable(l, t) for l in pair):
                        choice = list(pair)
                        break
                if choice is None:
                    choice = None
                if choice:
                    for l in choice:
                        lane_last[l] = t
                    notes.append((t, choice, 0.0))
                    bar_lanes.append(choice[0])
                    last_lane = choice[1] if choice[0] == last_lane else choice[0]
                    last_t = t
                    last_pitch = F['pitch'][g]
                    continue
            if reuse is not None:
                lane = reuse[n_i]
            else:
                dt = t - last_t
                p = F['pitch'][g]
                dp = 0 if last_pitch is None else p - last_pitch
                drum = max(F['low'][g], F['mid'][g], F['high'][g])
                melodic = F['mel'][g] >= 0.6 * drum
                if dt < 0.21:
                    # a run: keep going the way it goes (stairs) and bounce at the edges, or trill across hands
                    if abs(dp) >= 1.0:
                        run_dir = 1 if dp > 0 else -1
                    lane = last_lane + run_dir
                    if lane < 0 or lane > 3:
                        run_dir = -run_dir
                        lane = last_lane + run_dir
                    if diff == 'hard' and abs(dp) < 1.0 and (k + j) % 4 in (1, 3):
                        lane = (last_lane + 2) % 4       # a trill across both hands
                elif melodic and abs(dp) >= 1.0:
                    step = 2 if abs(dp) >= 5 else 1
                    lane = last_lane + (step if dp > 0 else -step)
                    if lane < 0 or lane > 3:
                        lane = last_lane - (step if dp > 0 else -step)
                elif not melodic and F['low'][g] >= max(F['mid'][g], F['high'][g]) * 1.1:
                    lane = 0 if last_lane != 0 else 1        # kicks lean left
                    if dt > 0.45 and last_lane in (0, 1):
                        lane = 1 - last_lane if (bar + n_i) % 3 else last_lane
                elif not melodic and F['mid'][g] >= F['low'][g]:
                    lane = 3 if last_lane != 3 else 2        # snares lean right
                    if dt > 0.45 and last_lane in (2, 3):
                        lane = 5 - last_lane if (bar + n_i) % 3 else last_lane
                else:
                    zig = -zig
                    lane = last_lane + zig
                    if lane < 0 or lane > 3:
                        lane = last_lane - zig
                if lane == last_lane:
                    repeat += 1
                    if repeat >= 2 or dt < 0.3:
                        lane = last_lane + (1 if last_lane < 2 else -1)
                        repeat = 0
                else:
                    repeat = 0
            lane = int(np.clip(lane, 0, 3))
            if not usable(lane, t):
                # the nearest free lane
                for d in (1, -1, 2, -2, 3, -3):
                    c = lane + d
                    if 0 <= c <= 3 and usable(c, t):
                        lane = c
                        break
                else:
                    continue                            # nowhere to put it: dropped
            if hold > 0:
                lane_free[lane] = t + hold + 0.1
            lane_last[lane] = t + hold
            notes.append((t, [lane], hold))
            bar_lanes.append(lane)
            last_lane, last_t, last_pitch = lane, t, F['pitch'][g]
        if len(bar_lanes) == len(gis):
            prev = memory.get(key)
            memory[key] = (bar_lanes if prev is None else prev[0], (prev[1] + 1) if prev else 1)
    return notes


# ---------- holds and doubles ----------

def choose_holds(song, cands, F, S, chosen, diff):
    if diff == 'easy':
        return {}
    holds = {}
    min_len = 0.75 if diff == 'normal' else 0.5          # in beats
    every = 7 if diff == 'normal' else 3                  # at most one hold in this many bars
    last_bar = -99
    chosen_set = sorted(chosen)
    for n, g in enumerate(chosen_set):
        t, level, k, j = cands[g]
        bar = (k - song.phase) // 4
        if bar - last_bar < every:
            continue
        if F['mel'][g] < 0.35 or F['energy'][g] < 0.15:
            continue
        beat = 60 / song.bpm_at(t)
        sus = F['sustain'][g]
        if sus < min_len * beat:
            continue
        # until the next chosen note on a beat or an 8th that's strong, at most 2 bars, ending on an 8th
        nxt = chosen_set[n + 1] if n + 1 < len(chosen_set) else None
        end = t + min(sus, 8 * beat)
        if nxt is not None and diff == 'normal':
            end = min(end, cands[nxt][0] - 0.5 * beat)
        steps = int(np.floor((end - t) / (beat / 2)))
        if steps < 2 * min_len:
            continue
        dur = steps * beat / 2
        if dur < 0.35:
            continue
        holds[g] = round(dur, 3)
        last_bar = bar
    return holds


def choose_doubles(song, cands, F, S, chosen, diff, holds):
    if diff == 'easy':
        return set()
    out = set()
    every = 4 if diff == 'normal' else 1
    last_bar = -99
    prev_e = 0
    for g in sorted(chosen):
        if g in holds:
            continue
        t, level, k, j = cands[g]
        bar = (k - song.phase) // 4
        on_one = level == 0 and (k - song.phase) % 4 == 0
        on_beat = level == 0
        E = F['energy'][g]
        hit = F['low'][g] + F['high'][g]
        jump = E - prev_e > 0.18
        prev_e = 0.7 * prev_e + 0.3 * E
        if diff == 'normal':
            if on_one and E > 0.55 and hit > 1.0 and (bar - last_bar >= every or jump):
                out.add(g)
                last_bar = bar
        else:
            if on_beat and E > 0.45 and hit > 0.9 and (on_one or (k - song.phase) % 4 == 2) and bar - last_bar >= every:
                out.add(g)
                last_bar = bar
    return out


# ---------- the whole chart ----------

def make_chart(song, cands, F, S, diff):
    chosen, d, mult = pick_scaled(song, cands, F, S, diff)
    holds = choose_holds(song, cands, F, S, chosen, diff)
    doubles = choose_doubles(song, cands, F, S, chosen, diff, holds)
    notes = lanes_for(song, cands, F, S, chosen, diff, holds, doubles)
    out = []
    for t, lanes, hold in notes:
        for l in lanes:
            out.append([round(float(t), 3), int(l)] + ([round(float(hold), 3)] if hold > 0 else []))
    out.sort(key=lambda n: (n[0], n[1]))
    return out, mult


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
    best, best_t = -1, 0.0
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


def build(sid, title, plots=None, sonify=None):
    song = Song(sid, title)
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
        print(f'   {diff:6s} {len(chart):4d} notes, {d:.2f}/s (x{mult:.2f}), {chords} doubles, {holds} holds'
              + (f'  PROBLEMS: {problems[:6]}' if problems else ''))
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('songs', nargs='*')
    ap.add_argument('--plots')
    ap.add_argument('--sonify')
    a = ap.parse_args()
    os.makedirs(CHARTS, exist_ok=True)
    todo = [(s, t) for s, t in SONGS if not a.songs or s in a.songs]
    for sid, title in todo:
        build(sid, title, a.plots, a.sonify)
    # the song select's list: every song, from its chart file
    index = []
    for sid, title in SONGS:
        p = chart_file(sid)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf8') as f:
            d = json.load(f)
        counts = {k: len(v) for k, v in d['charts'].items()}
        nps = {k: round(density(sorted(set(n[0] for n in v))), 2) for k, v in d['charts'].items()}
        index.append({'id': sid, 'title': d['title'], 'bpm': d['bpm'], 'duration': d['duration'], 'preview': d['preview'],
                      'notes': counts, 'nps': nps})
    with open(os.path.join(CHARTS, 'index.json'), 'w', encoding='utf8') as f:
        json.dump(index, f, separators=(',', ':'))


if __name__ == '__main__':
    main()
