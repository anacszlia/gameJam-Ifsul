var Render = (function () {
  var canvas = document.getElementById("view");
  var ctx = canvas.getContext("2d");
  var arena = CONFIG.arena;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    ctx.fillStyle = "#241628";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = "#3a2440";
    roundRect(28, 74, 904, 390, 28);
    ctx.fill();
    ctx.fillStyle = "#c9854a";
    roundRect(arena.x - 10, arena.y + arena.h + 8, arena.w + 20, 22, 8);
    ctx.fill();
  }

  function drawArena(world) {
    ctx.save();
    roundRect(arena.x, arena.y, arena.w, arena.h, 22);
    ctx.clip();
    ctx.fillStyle = "#f3e6cb";
    ctx.fillRect(arena.x, arena.y, arena.w, arena.h);
    var sizeW = arena.w / CONFIG.cols;
    var sizeH = arena.h / CONFIG.rows;
    var row;
    var col;
    for (row = 0; row < CONFIG.rows; row++) {
      for (col = 0; col < CONFIG.cols; col++) {
        var value = world.cells[row * CONFIG.cols + col];
        if (value < 0.03) continue;
        var alpha = Math.min(0.78, value * 0.7);
        ctx.fillStyle = value > 0.55
          ? "rgba(206, 132, 255, " + alpha + ")"
          : "rgba(164, 230, 78, " + alpha + ")";
        ctx.fillRect(arena.x + col * sizeW, arena.y + row * sizeH, sizeW + 0.5, sizeH + 0.5);
      }
    }
    ctx.restore();
    ctx.strokeStyle = "#8d5a32";
    ctx.lineWidth = 4;
    roundRect(arena.x, arena.y, arena.w, arena.h, 22);
    ctx.stroke();
  }

  function ear(creature) {
    ctx.fillStyle = shade(CONFIG.tierColor[creature.tier], -18);
    if (creature.tier === 1) {
      ctx.beginPath();
      ctx.ellipse(-10, -creature.r * 0.85, 5, 12, -0.3, 0, Math.PI * 2);
      ctx.ellipse(10, -creature.r * 0.85, 5, 12, 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (creature.tier === 2) {
      ctx.beginPath();
      ctx.arc(-creature.r * 0.55, -creature.r * 0.55, 9, 0, Math.PI * 2);
      ctx.arc(creature.r * 0.55, -creature.r * 0.55, 9, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(-8, -creature.r - 8);
    ctx.lineTo(0, -4);
    ctx.lineTo(8, -creature.r - 10);
    ctx.lineTo(16, -6);
    ctx.fill();
  }

  function shade(hex, amount) {
    var num = parseInt(hex.slice(1), 16);
    var r = clamp((num >> 16) + amount, 0, 255);
    var g = clamp(((num >> 8) & 255) + amount, 0, 255);
    var b = clamp((num & 255) + amount, 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function drawCreature(creature, time) {
    var bob = Math.sin(time * 4 + creature.seed) * 2.2;
    var squash = creature.squash || 0;
    ctx.save();
    ctx.translate(creature.x, creature.y + bob);
    ctx.scale(1 + squash * 0.28, 1 - squash * 0.18);
    ctx.fillStyle = "rgba(70, 40, 30, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, creature.r * 0.75, creature.r * 0.72, creature.r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (creature.tier === 3) {
      ctx.fillStyle = "rgba(214, 160, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, creature.r + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ear(creature);
    ctx.fillStyle = CONFIG.tierColor[creature.tier];
    ctx.beginPath();
    ctx.arc(0, 0, creature.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, creature.r * 0.28, creature.r * 0.48, creature.r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    drawFace(creature, time);
    ctx.restore();
  }

  function drawFace(creature, time) {
    var look = Math.sin(time * 1.7 + creature.seed) * 2;
    var eyeY = -creature.r * 0.12;
    ctx.fillStyle = "#3a241c";
    if (creature.tier < 3) {
      ctx.beginPath();
      ctx.arc(-7 + look, eyeY, creature.tier === 1 ? 2.4 : 3.1, 0, Math.PI * 2);
      ctx.arc(7 + look, eyeY, creature.tier === 1 ? 2.4 : 3.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#3a241c";
      ctx.lineWidth = 2;
      spiral(-8, eyeY, time + creature.seed);
      spiral(8, eyeY, time + creature.seed + 1);
    }
    ctx.fillStyle = "rgba(255, 120, 140, 0.45)";
    ctx.beginPath();
    ctx.ellipse(-creature.r * 0.48, 4, 3.2, 2.1, 0, 0, Math.PI * 2);
    ctx.ellipse(creature.r * 0.48, 4, 3.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a241c";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (creature.tier === 1) {
      ctx.arc(0, 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (creature.tier === 2) {
      ctx.arc(0, 8, 4, 1.15 * Math.PI, 1.85 * Math.PI);
    } else {
      ctx.arc(0, 7, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    }
    ctx.stroke();
  }

  function spiral(x, y, time) {
    ctx.beginPath();
    var a;
    for (a = 0; a < 9; a++) {
      var ang = time * 3 + a * 0.7;
      var rad = a * 0.45;
      var px = x + Math.cos(ang) * rad;
      var py = y + Math.sin(ang) * rad;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawFlask(flask) {
    ctx.save();
    ctx.translate(flask.x, flask.y);
    ctx.rotate(flask.angle + Math.PI / 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    roundRect(-6, -10, 12, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#9dff6a";
    ctx.fillRect(-4, -2, 8, 7);
    ctx.fillStyle = "#6d4634";
    ctx.fillRect(-3, -13, 6, 4);
    ctx.restore();
  }

  function drawAvatar(world, time) {
    var avatar = world.avatar;
    if (!avatar) return;
    var bob = avatar.moving ? Math.sin(time * 10) * 2 : 0;
    var ready = world.level ? (world.flask ? 0 : 1 - world.cooldown / CONFIG.cooldown) : 1;
    ctx.save();
    ctx.translate(avatar.x, avatar.y + bob);
    ctx.fillStyle = "rgba(70, 40, 30, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(avatar.facing + Math.PI / 2);
    ctx.fillStyle = "#3d6ea8";
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3c9a0";
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef8b5a";
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.lineTo(0, -26);
    ctx.lineTo(7, -16);
    ctx.fill();
    ctx.fillStyle = "#3a241c";
    ctx.beginPath();
    ctx.arc(-3, -10, 1.4, 0, Math.PI * 2);
    ctx.arc(3, -10, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(10, -2, 8, 12, 2);
    ctx.fill();
    ctx.fillStyle = ready > 0.95 ? "#b6ff6a" : "#7ed64a";
    ctx.fillRect(11.5, 4 - 6 * ready, 5, 6 * Math.max(0.15, ready));
    if (avatar.hurt > 0) {
      ctx.fillStyle = "rgba(255, 70, 70, " + Math.min(0.55, avatar.hurt * 3) + ")";
      ctx.beginPath();
      ctx.arc(0, -2, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCauldron(world, time) {
    var ready = 1;
    if (world.level) {
      ready = world.flask ? 0 : 1 - world.cooldown / CONFIG.cooldown;
    } else {
      ready = 0.72 + Math.sin(time * 2.4) * 0.06;
    }
    var wobble = world.deny > 0 ? Math.sin(time * 40) * 3 : 0;
    var x = CONFIG.cauldron.x + wobble;
    var y = CONFIG.cauldron.y;
    ctx.fillStyle = "rgba(50, 24, 28, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 24, 42, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a4038";
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4e2e2a";
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 28, 12, 0, 0, Math.PI * 2);
    ctx.clip();
    var liquidTop = y - 8 + 12 - 24 * ready;
    ctx.fillStyle = ready > 0.95 ? "#b6ff6a" : "#7ed64a";
    ctx.fillRect(x - 30, liquidTop, 60, 30);
    ctx.restore();
    ctx.strokeStyle = "#8d5a32";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 28, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (ready > 0.95) {
      var bubble = (time * 2) % 1;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(x - 6, y - 10 - bubble * 16, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 7, y - 6 - ((bubble + 0.4) % 1) * 14, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(world) {
    var i;
    for (i = 0; i < world.particles.length; i++) {
      var particle = world.particles[i];
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(world, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.save();
    if (world.shake > 0) {
      var mag = world.shake * 14;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawBackground();
    drawArena(world);
    var i;
    for (i = 0; i < world.creatures.length; i++) drawCreature(world.creatures[i], time);
    drawAvatar(world, time);
    drawParticles(world);
    if (world.flask) drawFlask(world.flask);
    drawCauldron(world, time);
    if (world.outcome && world.outcome.reason === "forbidden") {
      ctx.fillStyle = "rgba(255, 170, 214, " + Math.min(0.35, world.shake) + ")";
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }
    ctx.restore();
  }

  return { draw: draw };
})();
