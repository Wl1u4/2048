function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;
  this.blackHoleValue = 2048; // Two Suns (1024) collapse into a black hole

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("demo", this.loadDemo.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game over / singularity message
  this.setup();
};

// Dismiss the singularity message and keep collapsing
GameManager.prototype.keepPlaying = function () {
  this.actuator.continueGame();
};

// Return true if the game is lost, or a black hole is busy swallowing the board
GameManager.prototype.isGameTerminated = function () {
  return this.over || !!this.collapsing;
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  this.collapsing = false;

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.singularity = !!previousState.singularity;
    this.infinite    = !!previousState.infinite;
    this.maxValue    = Math.max(previousState.maxValue || 2, this.largestValue());
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.singularity = false;
    this.infinite    = false;
    this.maxValue    = 2;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();

  // A saved game can hold a black hole that never got to collapse
  if (!this.singularity) {
    var hole = this.findBlackHole();
    if (hole) this.collapse(hole);
  }
};

// Start a new game one swipe away from a black hole: two Suns side by side
GameManager.prototype.loadDemo = function () {
  var self = this;

  this.storageManager.clearGameState();
  this.actuator.continueGame();

  this.collapsing  = false;
  this.score       = 0;
  this.over        = false;
  this.singularity = false;
  this.infinite    = false;
  this.grid        = new Grid(this.size);

  [[0, 0, 512], [1, 0, 1024], [2, 0, 1024], [0, 1, 256],
   [1, 1, 32], [3, 2, 8], [2, 3, 64], [0, 3, 2]].forEach(function (t) {
    self.grid.insertTile(new Tile({ x: t[0], y: t[1] }, t[2]));
  });
  this.maxValue = 1024;

  this.actuate({ demo: true });
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
    this.maxValue = Math.max(this.maxValue || 2, value);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function (extra) {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  var metadata = {
    score:        this.score,
    over:         this.over,
    bestScore:    this.storageManager.getBestScore(),
    bestInfinite: this.bestInfinite(),
    terminated:   this.isGameTerminated(),
    singularity:  this.singularity,
    infinite:     this.infinite,
    maxValue:     this.maxValue
  };
  if (extra) {
    for (var key in extra) metadata[key] = extra[key];
  }

  this.actuator.actuate(this.grid, metadata);
};

// Has any game ever reached the singularity? (Storage without this method just says no)
GameManager.prototype.bestInfinite = function () {
  return typeof this.storageManager.getBestInfinite === "function" &&
         !!this.storageManager.getBestInfinite();
};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    singularity: this.singularity,
    infinite:    this.infinite,
    maxValue:    this.maxValue
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Can these two tiles merge? Normally only equal values do.
// Past the event horizon, any two bodies combine.
GameManager.prototype.canMerge = function (tile, other) {
  if (this.singularity) return true;
  return other.value === tile.value && tile.value < this.blackHoleValue;
};

// In the singularity, a merge climbs one step above the bigger body, up to a black hole
GameManager.prototype.singularityValue = function (tile, other) {
  return Math.min(this.blackHoleValue, Math.max(tile.value, other.value) * 2);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;
  var merges     = [];
  var blackHole  = null;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && !next.mergedFrom && self.canMerge(tile, next)) {
          var merged = new Tile(positions.next, tile.value * 2);
          if (self.singularity) merged.value = self.singularityValue(tile, next);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          merges.push(merged);
          self.maxValue = Math.max(self.maxValue || 2, merged.value);

          // Two Suns make a black hole, which swallows the whole system
          if (merged.value === self.blackHoleValue && !self.singularity && !blackHole) {
            blackHole = merged;
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (blackHole) {
      this.collapse(blackHole);
    } else if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate({ merges: merges, moved: true });
  }
};

// Find a black hole on the board, if there is one
GameManager.prototype.findBlackHole = function () {
  var self = this, hole = null;
  this.grid.eachCell(function (x, y, tile) {
    if (tile && !hole && tile.value >= self.blackHoleValue) hole = tile;
  });
  return hole;
};

// The biggest value on the board
GameManager.prototype.largestValue = function () {
  var largest = 2;
  this.grid.eachCell(function (x, y, tile) {
    if (tile && tile.value > largest) largest = tile.value;
  });
  return largest;
};

// A black hole formed: lock input while the actuator animates the collapse
GameManager.prototype.collapse = function (blackHole) {
  var self  = this;
  var token = {};

  this.collapsing = token;
  this.maxValue   = Math.max(this.maxValue || 2, this.blackHoleValue);

  var hole = { x: blackHole.x, y: blackHole.y };
  if (typeof this.actuator.collapse === "function") {
    this.actuator.collapse(hole, this.score, function () {
      if (self.collapsing === token) self.finishCollapse(hole);
    });
  } else {
    this.finishCollapse(hole);
  }
};

// Everything else is gone. From now on every merge counts, and the score is infinite.
GameManager.prototype.finishCollapse = function (hole) {
  this.collapsing  = false;
  this.singularity = true;
  this.infinite    = true;
  this.grid        = new Grid(this.size);

  var blackHole = new Tile(hole, this.blackHoleValue);
  blackHole.settled = true; // Already on screen, so skip the "new tile" pop
  this.grid.insertTile(blackHole);
  this.addStartTiles();

  if (typeof this.storageManager.setBestInfinite === "function") {
    this.storageManager.setBestInfinite(true);
  }

  this.actuate({ singularityStart: true });
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && self.canMerge(tile, other)) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
