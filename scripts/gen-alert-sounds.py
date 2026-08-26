"""Genere 6 sons WAV courts pour les alertes taches. Stdlib seulement."""
import wave, math, struct, os
from pathlib import Path

OUT = Path("public/alert-sounds")
RATE = 22050

def write_wav(name, samples):
    """samples : liste de floats [-1, 1]."""
    path = OUT / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        w.writeframes(frames)
    print(f"  ✓ {name}  {path.stat().st_size:>6} B")

def env(n, attack=0.02, release=0.3):
    """Enveloppe attack-release simple sur n samples."""
    out = []
    a = int(attack * RATE)
    r = int(release * RATE)
    for i in range(n):
        if i < a: out.append(i / a)
        elif i > n - r: out.append(max(0, (n - i) / r))
        else: out.append(1.0)
    return out

def tone(freq, dur, amp=0.6, wave_type="sin"):
    n = int(dur * RATE)
    e = env(n)
    out = []
    for i in range(n):
        t = i / RATE
        if wave_type == "sin":
            s = math.sin(2 * math.pi * freq * t)
        elif wave_type == "square":
            s = 1.0 if (math.sin(2 * math.pi * freq * t) > 0) else -1.0
        elif wave_type == "sawtooth":
            s = 2 * ((freq * t) - math.floor(freq * t + 0.5))
        out.append(amp * e[i] * s)
    return out

def silence(dur):
    return [0.0] * int(dur * RATE)

# 1) bell.wav : ding aigu (2 harmoniques 880 + 1760 Hz, decay 0.6s)
def gen_bell():
    n = int(0.7 * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        decay = math.exp(-3.5 * t)
        s = 0.6 * math.sin(2 * math.pi * 880 * t) + 0.3 * math.sin(2 * math.pi * 1760 * t)
        out.append(0.7 * decay * s)
    return out

# 2) buzzer.wav : bzz basse frequence square 180 Hz, 3 pulses
def gen_buzzer():
    out = []
    for _ in range(3):
        out += tone(180, 0.18, amp=0.55, wave_type="square")
        out += silence(0.06)
    return out

# 3) chime.wav : arpege C5-E5-G5-C6 (523, 659, 784, 1046)
def gen_chime():
    freqs = [523, 659, 784, 1046]
    out = []
    for f in freqs:
        out += tone(f, 0.25, amp=0.5, wave_type="sin")
    return out

# 4) siren.wav : sinusoide swept 500 -> 1000 -> 500 Hz, deux cycles
def gen_siren():
    dur = 1.6
    n = int(dur * RATE)
    e = env(n, attack=0.05, release=0.2)
    out = []
    for i in range(n):
        t = i / RATE
        cycle = (t % 0.4) / 0.4
        freq = 500 + 500 * (1 - abs(2 * cycle - 1))
        out.append(0.5 * e[i] * math.sin(2 * math.pi * freq * t))
    return out

# 5) klaxon.wav : biii-bo (deux notes 400 + 300 Hz)
def gen_klaxon():
    out = []
    out += tone(400, 0.25, amp=0.6, wave_type="sawtooth")
    out += silence(0.05)
    out += tone(300, 0.3, amp=0.6, wave_type="sawtooth")
    return out

# 6) whistle.wav : sifflet aigu 2500 Hz + vibrato
def gen_whistle():
    dur = 0.6
    n = int(dur * RATE)
    e = env(n, attack=0.05, release=0.15)
    out = []
    for i in range(n):
        t = i / RATE
        vib = 1 + 0.03 * math.sin(2 * math.pi * 6 * t)
        out.append(0.5 * e[i] * math.sin(2 * math.pi * 2500 * vib * t))
    return out

write_wav("bell.wav", gen_bell())
write_wav("buzzer.wav", gen_buzzer())
write_wav("chime.wav", gen_chime())
write_wav("siren.wav", gen_siren())
write_wav("klaxon.wav", gen_klaxon())
write_wav("whistle.wav", gen_whistle())

# README
(OUT / "README.md").write_text("""# Sons d'alertes prédéfinis

Sons courts générés programmatiquement (Python stdlib, aucun droit d'auteur).
Voir `scripts/gen-alert-sounds.py` pour la reproduction.

| Fichier | Description | Durée |
|---|---|---|
| bell.wav | Ding aigu 880Hz + harmonique décroissant | 0.7s |
| buzzer.wav | Bzz basse fréquence 180Hz square, 3 pulses | 0.75s |
| chime.wav | Arpège C5-E5-G5-C6 | 1.0s |
| siren.wav | Sinusoïde swept 500-1000-500Hz, deux cycles | 1.6s |
| klaxon.wav | Deux notes sawtooth 400+300Hz | 0.6s |
| whistle.wav | Sifflet aigu 2500Hz + vibrato | 0.6s |

Sons uploadés par les admins : `custom-<timestamp>.<ext>`.
""")
print(f"\n✅ 6 sons + README généré dans {OUT}")
