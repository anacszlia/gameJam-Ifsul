var Platform = (function () {
  var mode = "local";
  var playing = false;
  var adLock = false;
  var hasPlayed = false;

  function detect() {
    var host = (location.hostname || "").toLowerCase();
    if (host.indexOf("poki.") !== -1 || host.indexOf("poki.com") !== -1) return "poki";
    if (host.indexOf("crazygames.") !== -1) return "crazy";
    if (host.indexOf("newgrounds.com") !== -1 || host.indexOf("ungrounded.net") !== -1) return "newgrounds";
    return "local";
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("sdk")); };
      document.head.appendChild(script);
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve();
      }, ms);
      Promise.resolve(promise).then(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
    });
  }

  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  function init() {
    mode = detect();
    if (mode === "poki") {
      return withTimeout(
        loadScript("https://game-cdn.poki.com/scripts/v2/poki-sdk.js").then(function () {
          if (!window.PokiSDK) return;
          return window.PokiSDK.init();
        }),
        8000
      ).then(function () {
        if (!window.PokiSDK) mode = "local";
      });
    }
    if (mode === "crazy") {
      return withTimeout(
        loadScript("https://sdk.crazygames.com/crazygames-sdk-v3.js").then(function () {
          if (!window.CrazyGames || !window.CrazyGames.SDK) return;
          return window.CrazyGames.SDK.init();
        }),
        8000
      ).then(function () {
        if (!window.CrazyGames || !window.CrazyGames.SDK) {
          mode = "local";
          return;
        }
        safe(function () { window.CrazyGames.SDK.game.loadingStart(); });
      });
    }
    return Promise.resolve();
  }

  function loadingFinished() {
    if (mode === "poki" && window.PokiSDK) {
      safe(function () { window.PokiSDK.gameLoadingFinished(); });
    }
    if (mode === "crazy" && window.CrazyGames && window.CrazyGames.SDK) {
      safe(function () { window.CrazyGames.SDK.game.loadingStop(); });
    }
  }

  function gameplayStart() {
    if (playing || adLock) return;
    playing = true;
    if (mode === "poki" && window.PokiSDK) {
      safe(function () { window.PokiSDK.gameplayStart(); });
    }
    if (mode === "crazy" && window.CrazyGames && window.CrazyGames.SDK) {
      safe(function () { window.CrazyGames.SDK.game.gameplayStart(); });
    }
  }

  function gameplayStop() {
    if (!playing || adLock) return;
    playing = false;
    if (mode === "poki" && window.PokiSDK) {
      safe(function () { window.PokiSDK.gameplayStop(); });
    }
    if (mode === "crazy" && window.CrazyGames && window.CrazyGames.SDK) {
      safe(function () { window.CrazyGames.SDK.game.gameplayStop(); });
    }
  }

  function pokiBreak() {
    return window.PokiSDK.commercialBreak(function () {
      AudioFx.adMute(true);
    });
  }

  function crazyBreak() {
    return new Promise(function (resolve) {
      try {
        var result = window.CrazyGames.SDK.ad.requestAd("midgame", {
          adStarted: function () { AudioFx.adMute(true); },
          adFinished: function () { AudioFx.adMute(false); },
          adError: function () { AudioFx.adMute(false); }
        });
        if (result && typeof result.then === "function") result.then(resolve, resolve);
        else resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  function commercialBreak() {
    adLock = true;
    var run = Promise.resolve();
    if (mode === "poki" && window.PokiSDK && window.PokiSDK.commercialBreak) {
      run = Promise.resolve(safe(pokiBreak));
    } else if (mode === "crazy" && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
      run = crazyBreak();
    }
    return withTimeout(run, 45000).then(function () {
      AudioFx.adMute(false);
      adLock = false;
    });
  }

  function begin(wantBreak) {
    var job = wantBreak && hasPlayed ? commercialBreak() : Promise.resolve();
    return job.then(function () {
      hasPlayed = true;
      gameplayStart();
    });
  }

  function ngReady() {
    return mode === "newgrounds" && CONFIG.newgrounds && CONFIG.newgrounds.appId && window.NGIO;
  }

  function unlockMedal(id) {
    if (!ngReady() || !window.NGIO.unlockMedal) return;
    safe(function () { window.NGIO.unlockMedal(id); });
  }

  function submitScore(board, value) {
    if (!ngReady() || !window.NGIO.postScore) return;
    safe(function () { window.NGIO.postScore(board, value); });
  }

  return {
    init: init,
    loadingFinished: loadingFinished,
    gameplayStop: gameplayStop,
    startFromMenu: function () { return begin(false); },
    returnToPlay: function () { return begin(true); },
    unlockMedal: unlockMedal,
    submitScore: submitScore
  };
})();
