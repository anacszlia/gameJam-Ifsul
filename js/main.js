(function () {
  var canvas = document.getElementById("view");
  var stage = document.getElementById("stage");
  var hud = document.getElementById("hud");
  var card = document.getElementById("card");
  var cardTitle = document.getElementById("card-title");
  var cardBody = document.getElementById("card-body");
  var levelName = document.getElementById("level-name");
  var hint = document.getElementById("hint");
  var meterFill = document.getElementById("meter-fill");
  var meterText = document.getElementById("meter-text");
  var timer = document.getElementById("timer");
  var healthFill = document.getElementById("health-fill");
  var stick = document.getElementById("stick");
  var nub = document.getElementById("nub");
  var keys = {};
  var stickVec = { x: 0, y: 0 };
  var stickPointer = null;
  var muteHud = document.getElementById("btn-mute-hud");
  var buttons = {
    play: document.getElementById("act-play"),
    continue: document.getElementById("act-continue"),
    resume: document.getElementById("act-resume"),
    retry: document.getElementById("act-retry"),
    next: document.getElementById("act-next"),
    replay: document.getElementById("act-replay"),
    menu: document.getElementById("act-menu"),
    mute: document.getElementById("act-mute")
  };

  var state = "boot";
  var levelIndex = 0;
  var busy = false;
  var endLock = false;
  var last = 0;
  var save = readSave();

  function readSave() {
    var data = Storage.load() || {};
    var unlocked = Math.round(Number(data.unlocked));
    if (!unlocked || unlocked < 1) unlocked = 1;
    if (unlocked > LEVELS.length) unlocked = LEVELS.length;
    return {
      unlocked: unlocked,
      cleared: !!data.cleared,
      muted: !!data.muted
    };
  }

  function writeSave() {
    Storage.save(save);
  }

  function hideActions() {
    var key;
    for (key in buttons) {
      if (key === "mute") continue;
      buttons[key].hidden = true;
    }
  }

  function showCard(opts) {
    card.hidden = false;
    hud.hidden = true;
    stage.classList.remove("is-playing");
    document.getElementById("stick").hidden = true;
    releaseStick();
    cardTitle.textContent = opts.title;
    cardBody.textContent = opts.body;
    hideActions();
    buttons.play.hidden = !opts.play;
    buttons.continue.hidden = !opts.continue;
    buttons.resume.hidden = !opts.resume;
    buttons.retry.hidden = !opts.retry;
    buttons.next.hidden = !opts.next;
    buttons.replay.hidden = !opts.replay;
    buttons.menu.hidden = !opts.menu;
    buttons.mute.hidden = false;
    syncMute();
  }

  function showMenu() {
    state = "menu";
    showCard({
      title: CONFIG.title,
      body: "Ande com WASD. Os bichinhos seguem você e soltam radiação. Pisar na mancha tira vida. Clique para lançar o orvalho.",
      play: true,
      continue: save.unlocked > 1 || save.cleared,
      mute: true
    });
  }

  function showPlaying() {
    card.hidden = true;
    hud.hidden = false;
    stage.classList.add("is-playing");
    document.getElementById("stick").hidden = false;
    var level = LEVELS[levelIndex];
    levelName.textContent = "Fase " + level.id + " · " + level.name;
    hint.textContent = level.hint;
    timer.hidden = level.goal !== "hold";
    syncMute();
  }

  function showPause() {
    showCard({
      title: "Pausa",
      body: LEVELS[levelIndex].name,
      resume: true,
      retry: true,
      menu: true
    });
  }

  function endCopy(outcome) {
    if (outcome.result === "win" && outcome.reason === "held") {
      return "O surto segurou até o fim do tempo.";
    }
    if (outcome.result === "win" && levelIndex === LEVELS.length - 1) {
      return "A estufa ficou limpa. O surto foi contido.";
    }
    if (outcome.result === "win") return "A arena ficou limpa.";
    if (outcome.reason === "forbidden") return "Dois grandes demais se fundiram.";
    if (outcome.reason === "health") return "Você andou demais na radiação.";
    return "A radiação fechou a arena.";
  }

  function showEnd(outcome) {
    var lastLevel = levelIndex === LEVELS.length - 1;
    showCard({
      title: outcome.result === "win" ? "Vitória" : "Derrota",
      body: endCopy(outcome),
      retry: !(outcome.result === "win" && lastLevel),
      next: outcome.result === "win" && !lastLevel,
      replay: outcome.result === "win" && lastLevel,
      menu: true
    });
  }

  function syncMute() {
    var label = save.muted ? "Som mudo" : "Som ligado";
    buttons.mute.textContent = label;
    muteHud.textContent = save.muted ? "Mudo" : "Som";
    buttons.mute.setAttribute("aria-pressed", save.muted ? "true" : "false");
    muteHud.setAttribute("aria-pressed", save.muted ? "true" : "false");
  }

  function toggleMute() {
    save.muted = !save.muted;
    AudioFx.setMuted(save.muted);
    writeSave();
    syncMute();
  }

  function goLevel(index, withBreak) {
    if (busy) return;
    busy = true;
    card.classList.add("is-locked");
    var job = withBreak ? Platform.returnToPlay() : Platform.startFromMenu();
    job.then(function () {
      busy = false;
      card.classList.remove("is-locked");
      levelIndex = index;
      endLock = false;
      Sim.start(LEVELS[index]);
      state = "playing";
      showPlaying();
    });
  }

  function pause() {
    if (state !== "playing" || busy) return;
    state = "paused";
    Platform.gameplayStop();
    showPause();
  }

  function resume() {
    if (state !== "paused" || busy) return;
    busy = true;
    card.classList.add("is-locked");
    Platform.returnToPlay().then(function () {
      busy = false;
      card.classList.remove("is-locked");
      state = "playing";
      showPlaying();
    });
  }

  function toMenu() {
    if (busy) return;
    Platform.gameplayStop();
    showMenu();
  }

  function onLevelEnd(outcome) {
    state = "levelend";
    Platform.gameplayStop();
    if (outcome.result === "win") {
      var clearedCount = levelIndex + 1;
      save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
      if (levelIndex === LEVELS.length - 1) save.cleared = true;
      writeSave();
      Platform.unlockMedal("fase-" + clearedCount);
      Platform.submitScore("fases", clearedCount);
      AudioFx.win();
    } else if (outcome.reason !== "forbidden") {
      AudioFx.lose();
    }
    showEnd(outcome);
  }

  function updateHud() {
    if (state !== "playing") return;
    var world = Sim.world;
    var meter = Math.round(world.meter);
    meterFill.style.width = meter + "%";
    meterFill.style.background = meter > 70 ? "#d56bff" : "#b6e84a";
    meterText.textContent = meter + "%";
    var health = Math.max(0, Math.round(world.health));
    healthFill.style.width = health + "%";
    healthFill.style.background = health < 30 ? "#ff5d6c" : "#ffb0a0";
    if (world.level && world.level.goal === "hold") {
      var left = Math.max(0, world.level.time - world.elapsed);
      timer.textContent = left.toFixed(1) + "s";
    }
  }

  function logicalPoint(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function releaseStick() {
    stickPointer = null;
    stickVec.x = 0;
    stickVec.y = 0;
    nub.style.transform = "translate(-50%, -50%)";
  }

  function readMove() {
    var x = 0;
    var y = 0;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    x += stickVec.x;
    y += stickVec.y;
    return { x: x, y: y };
  }

  function loop(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var move = state === "playing" ? readMove() : { x: 0, y: 0 };
    Sim.setMove(move.x, move.y);
    if (state === "playing") {
      Sim.update(dt);
      if (Sim.world.outcome && !endLock) {
        endLock = true;
        onLevelEnd(Sim.world.outcome);
      }
    }
    Render.draw(Sim.world, now / 1000);
    updateHud();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    AudioFx.unlock();
    if (state !== "playing" || busy) return;
    var point = logicalPoint(event);
    Sim.throwAt(point.x, point.y);
  }, { passive: false });

  stage.addEventListener("touchmove", function (event) {
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  document.getElementById("btn-pause").addEventListener("click", function () {
    AudioFx.unlock();
    pause();
  });
  muteHud.addEventListener("click", function () {
    AudioFx.unlock();
    toggleMute();
  });
  buttons.play.addEventListener("click", function () {
    AudioFx.unlock();
    goLevel(0, false);
  });
  buttons.continue.addEventListener("click", function () {
    AudioFx.unlock();
    goLevel(save.unlocked - 1, false);
  });
  buttons.resume.addEventListener("click", function () {
    AudioFx.unlock();
    resume();
  });
  buttons.retry.addEventListener("click", function () {
    AudioFx.unlock();
    goLevel(levelIndex, true);
  });
  buttons.next.addEventListener("click", function () {
    AudioFx.unlock();
    goLevel(levelIndex + 1, true);
  });
  buttons.replay.addEventListener("click", function () {
    AudioFx.unlock();
    goLevel(0, true);
  });
  buttons.menu.addEventListener("click", function () {
    AudioFx.unlock();
    toMenu();
  });
  buttons.mute.addEventListener("click", function () {
    AudioFx.unlock();
    toggleMute();
  });

  function trackKey(event, pressed) {
    if (event.code === "KeyW" || event.code === "KeyA" || event.code === "KeyS" || event.code === "KeyD" ||
        event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      keys[event.code] = pressed;
      event.preventDefault();
    }
  }

  document.addEventListener("keydown", function (event) {
    trackKey(event, true);
    if (event.key !== "Escape" || event.repeat) return;
    if (state === "playing") pause();
    else if (state === "paused") resume();
  });

  document.addEventListener("keyup", function (event) {
    trackKey(event, false);
  });

  window.addEventListener("blur", function () {
    keys = {};
    releaseStick();
  });

  function moveStick(event) {
    if (event.pointerId !== stickPointer) return;
    var rect = stick.getBoundingClientRect();
    var dx = event.clientX - (rect.left + rect.width / 2);
    var dy = event.clientY - (rect.top + rect.height / 2);
    var max = rect.width * 0.34;
    var len = Math.hypot(dx, dy) || 1;
    var clamped = Math.min(len, max);
    stickVec.x = (dx / len) * (clamped / max);
    stickVec.y = (dy / len) * (clamped / max);
    nub.style.transform = "translate(calc(-50% + " + (stickVec.x * max) + "px), calc(-50% + " + (stickVec.y * max) + "px))";
  }

  stick.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    event.stopPropagation();
    AudioFx.unlock();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener("pointermove", moveStick);
  stick.addEventListener("pointerup", function (event) {
    if (event.pointerId === stickPointer) releaseStick();
  });
  stick.addEventListener("pointercancel", function (event) {
    if (event.pointerId === stickPointer) releaseStick();
  });

  AudioFx.setMuted(save.muted);
  document.title = CONFIG.title;
  Platform.init().then(function () {
    Platform.loadingFinished();
    showMenu();
    requestAnimationFrame(loop);
  });
})();
