// Draws the game: planet tiles, scores, the ladder of bodies, messages, and the black hole collapse.
function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.board            = document.querySelector(".game-container");
  this.boardWrap        = document.querySelector(".board-wrap");
  this.intro            = document.querySelector(".game-intro");
  this.rungs            = document.querySelector(".rungs");

  this.score       = 0;
  this.messageKind = null;
  this.timers      = [];
  this.racing      = false;
  this.cell        = 100;
  this.gap         = 10;

  var self = this;
  this.layout();
  if (window.ResizeObserver) {
    new ResizeObserver(function () { self.layout(); }).observe(this.board);
  } else {
    window.addEventListener("resize", function () { self.layout(); });
  }

  Effects.init(this.board, this.boardWrap);
  this.buildLadder();
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.setMode(metadata.singularity);
    self.updateScore(metadata);
    self.updateBestScore(metadata.bestScore, metadata.bestInfinite);
    self.updateLadder(metadata.maxValue);

    if (metadata.singularityStart) {
      self.message("singular", metadata);
    } else if (metadata.over) {
      self.message("over", metadata); // No moves left
    } else if (metadata.moved && self.messageKind === "singular") {
      self.clearMessage();
    }

    if (metadata.demo && self.board.scrollIntoView) {
      self.board.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  // A blast for every merge, timed for when the two tiles meet
  (metadata.merges || []).forEach(function (tile) {
    window.setTimeout(function () {
      var c = self.cellCenter(tile.x, tile.y);
      Effects.blast(c.x, c.y, Planets.levelFor(tile.value), self.cell);
    }, 120);
  });
};

// Continues the game (restart, demo, and dismissing the singularity message)
HTMLActuator.prototype.continueGame = function () {
  this.cancelCollapse();
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.layout = function () {
  var width = this.board.clientWidth;
  if (!width) return;
  this.gap  = width < 420 ? 8 : 11;
  this.cell = (width - 5 * this.gap) / 4;
  this.board.style.setProperty("--c", this.cell + "px");
  this.board.style.setProperty("--g", this.gap + "px");
};

HTMLActuator.prototype.cellCenter = function (x, y) {
  var rect = this.board.getBoundingClientRect();
  return {
    x: rect.left + this.board.clientLeft + this.gap + x * (this.cell + this.gap) + this.cell / 2,
    y: rect.top + this.board.clientTop + this.gap + y * (this.cell + this.gap) + this.cell / 2
  };
};

HTMLActuator.prototype.setPosition = function (element, position) {
  element.style.setProperty("--x", position.x);
  element.style.setProperty("--y", position.y);
};

HTMLActuator.prototype.addTile = function (tile) {
  var self     = this;
  var level    = Planets.levelFor(tile.value);
  var body     = Planets.BODIES[level];
  var name     = Planets.nameFor(tile.value);
  var wrapper  = document.createElement("div");
  var inner    = document.createElement("div");
  var position = tile.previousPosition || { x: tile.x, y: tile.y };

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value, "lv" + level];
  if (Planets.isAnomaly(tile.value)) classes.push("tile-anomaly");

  this.setPosition(wrapper, position);
  wrapper.setAttribute("data-x", tile.x);
  wrapper.setAttribute("data-y", tile.y);
  wrapper.setAttribute("data-level", level);
  wrapper.setAttribute("role", "img");
  wrapper.setAttribute("aria-label", name + ", " + tile.value);

  inner.className = "tile-inner";
  inner.style.background = body.bg;

  var image = document.createElement("img");
  image.src = body.url;
  image.alt = "";
  image.draggable = false;
  image.style.width = (body.img * 100).toFixed(1) + "%";
  inner.appendChild(image);

  if (level === Planets.BH) {
    var spin = document.createElement("i");
    spin.className = "bh-spin";
    inner.appendChild(spin);
  }

  var value = document.createElement("span");
  value.className = "val";
  value.textContent = tile.value;
  var label = document.createElement("span");
  label.className = "nm";
  label.textContent = name;
  inner.appendChild(value);
  inner.appendChild(label);

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      self.setPosition(wrapper, { x: tile.x, y: tile.y }); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else if (!tile.settled) {
    classes.push("tile-new");
  }

  wrapper.className = classes.join(" ");

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.format = function (value) {
  if (value < 1e9) return Math.round(value).toLocaleString("en-US");
  return value.toExponential(1).replace("e+", "e");
};

HTMLActuator.prototype.updateScore = function (metadata) {
  if (this.racing) return; // The collapse animation owns the score until it ends

  var score      = metadata.score;
  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.classList.remove("racing");
  this.scoreContainer.classList.toggle("inf", !!metadata.infinite);
  this.scoreContainer.textContent = metadata.infinite ? "∞" : this.format(score);

  if (metadata.infinite) {
    if (metadata.merges && metadata.merges.length) this.scoreAddition("+∞");
  } else if (difference > 0) {
    this.scoreAddition("+" + this.format(difference));
  }
};

HTMLActuator.prototype.scoreAddition = function (text) {
  var addition = document.createElement("span");
  addition.className = "score-addition";
  addition.textContent = text;
  addition.addEventListener("animationend", function () {
    if (addition.parentNode) addition.parentNode.removeChild(addition);
  });
  this.scoreContainer.parentNode.appendChild(addition);
};

HTMLActuator.prototype.updateBestScore = function (bestScore, bestInfinite) {
  this.bestContainer.classList.toggle("inf", !!bestInfinite);
  this.bestContainer.textContent = bestInfinite ? "∞" : this.format(+bestScore || 0);
};

HTMLActuator.prototype.setMode = function (singularity) {
  this.boardWrap.classList.toggle("singular", !!singularity);
  Effects.setSingular(singularity);
  this.intro.innerHTML = singularity
    ? '<span class="chip">Singularity</span>Any two bodies now merge when they touch, and the score is infinite.'
    : "Slide to merge matching bodies. Two Plutos make a Mercury, and two Suns collapse into a <b>black hole</b>.";
};

HTMLActuator.prototype.buildLadder = function () {
  var self = this;
  this.clearContainer(this.rungs);
  Planets.BODIES.forEach(function (body, level) {
    if (!body) return;
    var item = document.createElement("li");
    item.className = "rung";
    item.setAttribute("data-level", level);
    item.innerHTML =
      '<span class="pic"><img alt="" src="' + body.url + '" style="width:' + (body.img * 100).toFixed(1) + '%"></span>' +
      '<span class="txt"><span class="nm">' + body.name + '<span class="here">Largest</span></span>' +
      '<span class="km">' + body.km + "</span></span>" +
      '<span class="v">' + (level === Planets.BH ? "2048 → ∞" : Math.pow(2, level)) + "</span>";
    self.rungs.appendChild(item);
  });
};

HTMLActuator.prototype.updateLadder = function (maxValue) {
  var top = Planets.levelFor(maxValue || 2);
  Array.prototype.forEach.call(this.rungs.children, function (item) {
    var level = +item.getAttribute("data-level");
    item.classList.toggle("reached", level <= top);
    item.classList.toggle("top", level === top);
  });
};

HTMLActuator.prototype.message = function (kind, metadata) {
  var container = this.messageContainer;
  this.messageKind = kind;

  container.classList.remove("game-over");
  container.classList.remove("game-singular");
  container.classList.add(kind === "over" ? "game-over" : "game-singular");

  var kicker = container.querySelector(".ov-kicker");
  var title  = container.querySelector(".ov-title");
  var sub    = container.querySelector(".ov-sub");

  if (kind === "over") {
    kicker.textContent = "No moves left";
    title.textContent  = "Orbit locked";
    sub.textContent    = "Largest body: " + Planets.nameFor(metadata.maxValue || 2) +
                         ". Final score " + this.format(metadata.score) + ".";
  } else {
    kicker.textContent = "Event horizon crossed";
    title.textContent  = "∞";
    sub.textContent    = "Two Suns collapsed into a black hole and swallowed the system. " +
                         "Your score is now infinite, and from here on any two bodies merge when they touch.";
  }

  container.querySelector(".retry-button").hidden = kind !== "over";
  container.querySelector(".keep-playing-button").hidden = kind === "over";
  container.hidden = false;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-over");
  this.messageContainer.classList.remove("game-singular");
  this.messageContainer.hidden = true;
  this.messageKind = null;
};

/* ---------- the black hole collapse ---------- */

HTMLActuator.prototype.later = function (fn, ms) {
  this.timers.push(window.setTimeout(fn, ms));
};

HTMLActuator.prototype.cancelCollapse = function () {
  this.timers.forEach(function (id) { window.clearTimeout(id); });
  this.timers = [];
  this.racing = false;
  this.scoreContainer.classList.remove("racing");
};

// Pulls every body into the black hole, races the score to infinity, then calls done()
HTMLActuator.prototype.collapse = function (hole, score, done) {
  var self = this;

  // Wait for the merge that made the black hole to finish animating
  this.later(function () {
    Effects.setSingular(true);
    var center = self.cellCenter(hole.x, hole.y);
    Effects.implode(center.x, center.y, self.cell);
    Effects.shake("l");

    Array.prototype.slice.call(self.tileContainer.children).forEach(function (wrapper) {
      var x = +wrapper.getAttribute("data-x");
      var y = +wrapper.getAttribute("data-y");
      var atHole = x === hole.x && y === hole.y;

      if (atHole && wrapper.classList.contains("tile-merged")) {
        wrapper.classList.add("tile-gulp");
        return;
      }

      var delay = Math.round(Math.hypot(x - hole.x, y - hole.y) * 85);
      var inner = wrapper.firstChild;
      wrapper.style.zIndex = 0;
      wrapper.style.transition = "transform 850ms cubic-bezier(.6,0,.9,.35) " + delay + "ms";
      inner.style.transition = "transform 850ms cubic-bezier(.6,0,.9,.35) " + delay + "ms, opacity 300ms ease " + (delay + 600) + "ms";
      window.requestAnimationFrame(function () {
        self.setPosition(wrapper, { x: hole.x, y: hole.y });
        inner.style.transform = "scale(.08) rotate(320deg)";
        inner.style.opacity = "0";
      });

      if (!atHole) {
        var from = self.cellCenter(x, y), level = +wrapper.getAttribute("data-level");
        self.later(function () { Effects.inflow(from.x, from.y, center.x, center.y, level, self.cell); }, delay);
      }
    });

    self.raceToInfinity(score, 1300);
    self.later(function () {
      var c = self.cellCenter(hole.x, hole.y);
      Effects.flashOut(c.x, c.y, self.cell);
      Effects.shake("xl");
    }, 1250);
    self.later(function () {
      self.racing = false;
      done();
    }, 1420);
  }, 360);
};

HTMLActuator.prototype.raceToInfinity = function (start, duration) {
  var self = this, t0 = performance.now(), base = Math.max(start, 1);
  this.racing = true;
  this.scoreContainer.classList.add("racing");

  function step(now) {
    if (!self.racing) return;
    var t = (now - t0) / duration;
    if (t >= 1) {
      self.racing = false;
      self.scoreContainer.classList.remove("racing");
      self.scoreContainer.classList.add("inf");
      self.scoreContainer.textContent = "∞";
      return;
    }
    self.scoreContainer.textContent = self.format(base * Math.pow(10, Math.pow(t, 2.4) * 12));
    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);
};
