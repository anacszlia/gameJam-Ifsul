var Sim = (function () {
  var nextId = 1;
  var arena = CONFIG.arena;
  var world = {
    creatures: [],
    particles: [],
    flask: null,
    cooldown: 0,
    deny: 0,
    cells: new Float32Array(CONFIG.cols * CONFIG.rows),
    elapsed: 0,
    level: null,
    outcome: null,
    shake: 0,
    meter: 0,
    health: CONFIG.healthMax,
    moveX: 0,
    moveY: 0,
    stain: 0,
    hurtTick: 0,
    avatar: { x: 480, y: 390, facing: -Math.PI / 2, hurt: 0, moving: false }
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cellSize() {
    return {
      w: arena.w / CONFIG.cols,
      h: arena.h / CONFIG.rows
    };
  }

  function makeCreature(x, y, tier, speed) {
    return {
      id: nextId++,
      x: x,
      y: y,
      tier: tier,
      r: CONFIG.radius[tier],
      speed: speed,
      angle: Math.random() * Math.PI * 2,
      turnIn: 0.35 + Math.random() * 0.8,
      lock: 0.45,
      squash: 1,
      seed: Math.random() * 10,
      dead: false
    };
  }

  function pointInArena(fractionX, fractionY, radius) {
    return {
      x: arena.x + radius + fractionX * (arena.w - radius * 2),
      y: arena.y + radius + fractionY * (arena.h - radius * 2)
    };
  }

  function randomSpot(radius, placed) {
    var spot = null;
    var attempt;
    for (attempt = 0; attempt < 90; attempt++) {
      var pos = pointInArena(Math.random(), Math.random(), radius);
      var ok = true;
      var p;
      for (p = 0; p < placed.length; p++) {
        var need = radius + placed[p].r + 34;
        if (Math.hypot(pos.x - placed[p].x, pos.y - placed[p].y) < need) ok = false;
      }
      if (ok) {
        spot = pos;
        break;
      }
    }
    return spot || pointInArena(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, radius);
  }

  function stamp(x, y, radius, amount) {
    var size = cellSize();
    var c0 = clamp(Math.floor((x - radius - arena.x) / size.w), 0, CONFIG.cols - 1);
    var c1 = clamp(Math.floor((x + radius - arena.x) / size.w), 0, CONFIG.cols - 1);
    var r0 = clamp(Math.floor((y - radius - arena.y) / size.h), 0, CONFIG.rows - 1);
    var r1 = clamp(Math.floor((y + radius - arena.y) / size.h), 0, CONFIG.rows - 1);
    var row;
    var col;
    for (row = r0; row <= r1; row++) {
      for (col = c0; col <= c1; col++) {
        var cx = arena.x + (col + 0.5) * size.w;
        var cy = arena.y + (row + 0.5) * size.h;
        var dist = Math.hypot(cx - x, cy - y);
        if (dist > radius) continue;
        var fall = 1 - dist / radius;
        var index = row * CONFIG.cols + col;
        world.cells[index] = clamp(world.cells[index] + amount * fall, 0, 1.5);
      }
    }
  }

  function burst(x, y, color, count) {
    var i;
    for (i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 30 + Math.random() * 90;
      var life = 0.35 + Math.random() * 0.3;
      world.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        max: life,
        r: 2 + Math.random() * 3,
        color: color
      });
    }
    if (world.particles.length > 90) {
      world.particles.splice(0, world.particles.length - 90);
    }
  }

  function findCreature(id) {
    var i;
    for (i = 0; i < world.creatures.length; i++) {
      if (world.creatures[i].id === id && !world.creatures[i].dead) return world.creatures[i];
    }
    return null;
  }

  function creatureAt(x, y) {
    var best = null;
    var bestDist = Infinity;
    var i;
    for (i = 0; i < world.creatures.length; i++) {
      var creature = world.creatures[i];
      if (creature.dead) continue;
      var dist = Math.hypot(creature.x - x, creature.y - y);
      if (dist <= creature.r + 16 && dist < bestDist) {
        best = creature;
        bestDist = dist;
      }
    }
    return best;
  }

  function insideArena(x, y) {
    return x >= arena.x && y >= arena.y && x <= arena.x + arena.w && y <= arena.y + arena.h;
  }

  function cure(creature) {
    AudioFx.cure();
    burst(creature.x, creature.y, CONFIG.tierColor[creature.tier], 12);
    stamp(creature.x, creature.y, creature.r * 2.4, -0.9);
    if (creature.tier <= 1) {
      creature.dead = true;
      return;
    }
    creature.tier -= 1;
    creature.r = CONFIG.radius[creature.tier];
    creature.squash = 1;
    creature.lock = 0.2;
  }

  function moveAvatar(dt) {
    var avatar = world.avatar;
    var len = Math.hypot(world.moveX, world.moveY);
    avatar.moving = len > 0.08;
    if (avatar.moving) {
      var nx = world.moveX / len;
      var ny = world.moveY / len;
      avatar.x += nx * CONFIG.avatarSpeed * dt;
      avatar.y += ny * CONFIG.avatarSpeed * dt;
      avatar.facing = Math.atan2(ny, nx);
    }
    var radius = CONFIG.avatarRadius;
    avatar.x = clamp(avatar.x, arena.x + radius, arena.x + arena.w - radius);
    avatar.y = clamp(avatar.y, arena.y + radius, arena.y + arena.h - radius);
    avatar.hurt = Math.max(0, avatar.hurt - dt);
  }

  function moveCreatures(dt) {
    var i;
    var j;
    for (i = 0; i < world.creatures.length; i++) {
      var creature = world.creatures[i];
      creature.lock = Math.max(0, creature.lock - dt);
      creature.squash = Math.max(0, creature.squash - dt * 3.2);
      var dx = world.avatar.x - creature.x;
      var dy = world.avatar.y - creature.y;
      var dist = Math.hypot(dx, dy) || 1;
      var sx = dx / dist;
      var sy = dy / dist;
      var side = Math.sin(world.elapsed * 2.4 + creature.seed);
      sx += (-dy / dist) * side * 0.35;
      sy += (dx / dist) * side * 0.35;
      for (j = 0; j < world.creatures.length; j++) {
        if (i === j) continue;
        var other = world.creatures[j];
        var ox = creature.x - other.x;
        var oy = creature.y - other.y;
        var gap = Math.hypot(ox, oy) || 1;
        var overlap = (creature.r + other.r) * 0.55;
        if (gap < overlap) {
          var push = (overlap - gap) / overlap;
          sx += (ox / gap) * push;
          sy += (oy / gap) * push;
        }
      }
      var steer = Math.hypot(sx, sy) || 1;
      creature.angle = Math.atan2(sy, sx);
      var speed = creature.speed;
      if (dist < creature.r + CONFIG.avatarRadius + 10) speed *= 0.45;
      creature.x += (sx / steer) * speed * dt;
      creature.y += (sy / steer) * speed * dt;
      creature.x = clamp(creature.x, arena.x + creature.r, arena.x + arena.w - creature.r);
      creature.y = clamp(creature.y, arena.y + creature.r, arena.y + arena.h - creature.r);
    }
  }

  function fuse() {
    var removed = {};
    var born = [];
    var i;
    var j;
    for (i = 0; i < world.creatures.length; i++) {
      if (removed[i]) continue;
      var a = world.creatures[i];
      if (a.dead || a.lock > 0) continue;
      for (j = i + 1; j < world.creatures.length; j++) {
        if (removed[j]) continue;
        var b = world.creatures[j];
        if (b.dead || b.lock > 0) continue;
        if (a.tier !== b.tier) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
        var midX = (a.x + b.x) / 2;
        var midY = (a.y + b.y) / 2;
        if (a.tier >= 3) {
          a.dead = true;
          b.dead = true;
          world.shake = 0.45;
          world.flask = null;
          AudioFx.forbidden();
          burst(midX, midY, CONFIG.tierColor[3], 24);
          world.outcome = { result: "lose", reason: "forbidden" };
          world.creatures = world.creatures.filter(function (creature) { return !creature.dead; });
          return true;
        }
        removed[i] = true;
        removed[j] = true;
        var tier = a.tier + 1;
        var baby = makeCreature(midX, midY, tier, Math.max(a.speed, b.speed) * 0.92);
        baby.squash = 1;
        baby.lock = 0.4;
        born.push(baby);
        AudioFx.fusion(tier);
        burst(midX, midY, CONFIG.tierColor[tier], 16);
        break;
      }
    }
    if (born.length) {
      world.creatures = world.creatures.filter(function (creature, index) {
        return !removed[index] && !creature.dead;
      }).concat(born);
    }
    return false;
  }

  function updateFlask(dt) {
    var flask = world.flask;
    if (!flask) return;
    var target = flask.targetId ? findCreature(flask.targetId) : null;
    if (flask.targetId && !target) flask.targetId = 0;
    if (target) {
      flask.tx = target.x;
      flask.ty = target.y;
    }
    var dx = flask.tx - flask.x;
    var dy = flask.ty - flask.y;
    var dist = Math.hypot(dx, dy) || 0.0001;
    var step = CONFIG.flaskSpeed * dt;
    flask.angle = Math.atan2(dy, dx);
    var arrived = dist <= step + 6;
    if (!arrived && target && dist <= target.r + 8) arrived = true;
    if (!arrived) {
      flask.x += (dx / dist) * step;
      flask.y += (dy / dist) * step;
      return;
    }
    if (target) cure(target);
    else {
      stamp(flask.tx, flask.ty, CONFIG.splashRadius, -0.75);
      AudioFx.splash();
      burst(flask.tx, flask.ty, "#e7ffb0", 8);
    }
    world.flask = null;
    world.creatures = world.creatures.filter(function (creature) { return !creature.dead; });
  }

  function emit(dt) {
    var pressure = world.level ? world.level.pressure : 1;
    var i;
    for (i = 0; i < world.creatures.length; i++) {
      var creature = world.creatures[i];
      if (creature.dead) continue;
      var amount = CONFIG.paint[creature.tier] * pressure * dt;
      stamp(creature.x, creature.y, creature.r * 2.15, amount);
    }
  }

  function decay(dt) {
    var keep = Math.exp(-CONFIG.decay * dt);
    var i;
    for (i = 0; i < world.cells.length; i++) world.cells[i] *= keep;
  }

  function computeMeter() {
    var sum = 0;
    var i;
    for (i = 0; i < world.cells.length; i++) sum += Math.min(1, world.cells[i]);
    return Math.min(100, (sum / CONFIG.meterSum) * 100);
  }

  function updateParticles(dt) {
    var i;
    for (i = world.particles.length - 1; i >= 0; i--) {
      var particle = world.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) world.particles.splice(i, 1);
    }
  }

  function stainAt(x, y) {
    var size = cellSize();
    var col = (x - arena.x) / size.w - 0.5;
    var row = (y - arena.y) / size.h - 0.5;
    var c0 = clamp(Math.floor(col), 0, CONFIG.cols - 1);
    var r0 = clamp(Math.floor(row), 0, CONFIG.rows - 1);
    var c1 = clamp(c0 + 1, 0, CONFIG.cols - 1);
    var r1 = clamp(r0 + 1, 0, CONFIG.rows - 1);
    var tx = clamp(col - c0, 0, 1);
    var ty = clamp(row - r0, 0, 1);
    function at(c, r) {
      return world.cells[r * CONFIG.cols + c];
    }
    return at(c0, r0) * (1 - tx) * (1 - ty) +
      at(c1, r0) * tx * (1 - ty) +
      at(c0, r1) * (1 - tx) * ty +
      at(c1, r1) * tx * ty;
  }

  function hurtAvatar(dt) {
    var avatar = world.avatar;
    var stain = Math.max(
      stainAt(avatar.x, avatar.y),
      stainAt(avatar.x - 10, avatar.y),
      stainAt(avatar.x + 10, avatar.y),
      stainAt(avatar.x, avatar.y + 8)
    );
    world.stain = stain;
    if (stain <= CONFIG.hurtThreshold) return;
    world.health = Math.max(0, world.health - (stain - CONFIG.hurtThreshold) * CONFIG.hurtRate * dt);
    avatar.hurt = 0.16;
    world.hurtTick -= dt;
    if (world.hurtTick <= 0) {
      world.hurtTick = 0.34;
      AudioFx.hurt();
    }
    if (world.health <= 0) {
      world.outcome = { result: "lose", reason: "health" };
      world.shake = 0.35;
    }
  }

  function finishIfNeeded() {
    if (world.outcome || !world.level) return;
    var alive = 0;
    var i;
    for (i = 0; i < world.creatures.length; i++) {
      if (!world.creatures[i].dead) alive++;
    }
    if (world.health <= 0) {
      world.outcome = { result: "lose", reason: "health" };
      return;
    }
    if (world.level.goal === "cure-all" && alive === 0) {
      world.outcome = { result: "win", reason: "cleared" };
      return;
    }
    if (world.meter >= world.level.radiationLimit) {
      world.outcome = { result: "lose", reason: "radiation" };
      return;
    }
    if (world.level.goal === "hold" && world.elapsed >= world.level.time) {
      world.outcome = { result: "win", reason: "held" };
    }
  }

  function placeAvatar() {
    world.avatar.x = arena.x + arena.w * 0.5;
    world.avatar.y = arena.y + arena.h - 28;
    world.avatar.facing = -Math.PI / 2;
    world.avatar.hurt = 0;
    world.avatar.moving = false;
    world.health = CONFIG.healthMax;
    world.moveX = 0;
    world.moveY = 0;
    world.stain = 0;
    world.hurtTick = 0;
  }

  function start(level) {
    world.creatures = [];
    world.particles = [];
    world.flask = null;
    world.cooldown = 0;
    world.deny = 0;
    world.cells = new Float32Array(CONFIG.cols * CONFIG.rows);
    world.elapsed = 0;
    world.level = level;
    world.outcome = null;
    world.shake = 0;
    world.meter = 0;
    placeAvatar();
    var placed = [];
    var blocked = [{ x: world.avatar.x, y: world.avatar.y, r: 72 }];
    var s;
    for (s = 0; s < level.spawns.length; s++) {
      var group = level.spawns[s];
      if (group.x != null) {
        var fixed = pointInArena(group.x, group.y, CONFIG.radius[group.tier]);
        placed.push(makeCreature(fixed.x, fixed.y, group.tier, group.speed));
        continue;
      }
      var n;
      for (n = 0; n < group.count; n++) {
        var spot = randomSpot(CONFIG.radius[group.tier], blocked.concat(placed));
        placed.push(makeCreature(spot.x, spot.y, group.tier, group.speed));
      }
    }
    world.creatures = placed;
  }

  function update(dt) {
    if (world.outcome || !world.level) return;
    world.elapsed += dt;
    world.cooldown = Math.max(0, world.cooldown - dt);
    world.shake = Math.max(0, world.shake - dt);
    world.deny = Math.max(0, world.deny - dt);
    moveAvatar(dt);
    moveCreatures(dt);
    if (fuse()) return;
    updateFlask(dt);
    emit(dt);
    decay(dt);
    world.meter = computeMeter();
    hurtAvatar(dt);
    updateParticles(dt);
    finishIfNeeded();
  }

  function throwAt(x, y) {
    if (!world.level || world.outcome) return false;
    if (!insideArena(x, y)) return false;
    if (world.cooldown > 0 || world.flask) {
      world.deny = 0.16;
      return false;
    }
    var target = creatureAt(x, y);
    var facing = world.avatar.facing;
    world.flask = {
      x: world.avatar.x + Math.cos(facing) * 18,
      y: world.avatar.y + Math.sin(facing) * 18,
      tx: target ? target.x : x,
      ty: target ? target.y : y,
      targetId: target ? target.id : 0,
      angle: 0
    };
    world.cooldown = CONFIG.cooldown;
    AudioFx.toss();
    return true;
  }

  function setMove(x, y) {
    world.moveX = x || 0;
    world.moveY = y || 0;
  }

  placeAvatar();

  return {
    world: world,
    start: start,
    update: update,
    throwAt: throwAt,
    setMove: setMove
  };
})();
