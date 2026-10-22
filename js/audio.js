var AudioFx = (function () {
  var ctx = null;
  var master = null;
  var noise = null;
  var userMuted = false;
  var adMuted = false;

  function audible() {
    return ctx && master && !userMuted && !adMuted;
  }

  function applyGain() {
    if (!master || !ctx) return;
    master.gain.setTargetAtTime(userMuted || adMuted ? 0 : 0.85, ctx.currentTime, 0.01);
  }

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      applyGain();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function setMuted(muted) {
    userMuted = !!muted;
    applyGain();
  }

  function isMuted() {
    return userMuted;
  }

  function adMute(on) {
    adMuted = !!on;
    applyGain();
  }

  function noiseBuffer() {
    if (noise) return noise;
    var length = Math.floor(ctx.sampleRate * 0.25);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = noise.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function tone(freq, dur, type, gain, slide) {
    if (!audible()) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function burst(dur, gain, freq) {
    if (!audible()) return;
    var src = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var amp = ctx.createGain();
    var t = ctx.currentTime;
    src.buffer = noiseBuffer();
    filter.type = "bandpass";
    filter.frequency.value = freq || 900;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function play(fn) {
    try {
      unlock();
      fn();
    } catch (e) {}
  }

  function wobble() {
    return 0.92 + Math.random() * 0.16;
  }

  return {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    adMute: adMute,
    toss: function () {
      play(function () {
        tone(420 * wobble(), 0.08, "square", 0.08, 760);
      });
    },
    cure: function () {
      play(function () {
        var w = wobble();
        tone(620 * w, 0.1, "sine", 0.12, 880 * w);
        tone(990 * w, 0.14, "triangle", 0.06, 1320 * w);
      });
    },
    splash: function () {
      play(function () {
        burst(0.12, 0.08, 600);
        tone(360 * wobble(), 0.16, "sine", 0.07, 180);
      });
    },
    fusion: function (tier) {
      play(function () {
        var w = wobble();
        if (tier >= 3) {
          burst(0.1, 0.16, 280);
          tone(240 * w, 0.22, "square", 0.12, 90);
          tone(180 * w, 0.18, "sawtooth", 0.05, 70);
          return;
        }
        tone(520 * w, 0.16, "triangle", 0.13, 1480 * w);
        tone(880 * w, 0.1, "square", 0.05, 420 * w);
      });
    },
    forbidden: function () {
      play(function () {
        burst(0.18, 0.18, 200);
        tone(150, 0.42, "sawtooth", 0.14, 70);
        tone(190, 0.36, "square", 0.08, 90);
      });
    },
    win: function () {
      play(function () {
        tone(523, 0.1, "triangle", 0.1, 659);
        tone(784, 0.18, "sine", 0.08, 1046);
      });
    },
    lose: function () {
      play(function () {
        tone(220, 0.22, "sine", 0.1, 110);
      });
    },
    hurt: function () {
      play(function () {
        tone(160 * wobble(), 0.07, "square", 0.05, 70);
      });
    }
  };
})();
