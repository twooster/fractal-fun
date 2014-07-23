GravTree = function(opts) {
  this.parent = opts.parent;
  this.depth  = opts.depth;

  this.x0 = opts.x0;
  this.y0 = opts.y0;
  this.x1 = opts.x1;
  this.y1 = opts.y1;
  this.nw = null;
  this.sw = null;
  this.ne = null;
  this.se = null;

  this.cogCache = false;

  this.x = 0;
  this.y = 0;
  this.m = 0;

  this.points = [];
}

GravTree.prototype.MAX_CAPACITY = 16;
GravTree.prototype.PRUNE_SIZE = 8;
GravTree.prototype.MIN_DEPTH = 0;

GravTree.prototype.contains = function(x, y) {
  return x >= this.x0 && x < this.x1 && y >= this.y0 && y < this.y1;
}

GravTree.prototype.subdivide = function() {
  var xMid   = this.x0 + (this.x1 - this.x0) / 2,
      yMid   = this.y0 + (this.y1 - this.y0) / 2,
      nw     = this.createChildTree(this.x0, this.y0, xMid, yMid),
      ne     = this.createChildTree(xMid, this.y0, this.x1, yMid),
      sw     = this.createChildTree(this.x0, yMid, xMid, this.y1),
      se     = this.createChildTree(xMid, yMid, this.x1, this.y1),
      points = this.points,
      point;

  for (var i = 0; i < points.length; ++i) {
    point = points[i];
    if (nw.insert(point)) { continue; }
    if (ne.insert(point)) { continue; }
    if (sw.insert(point)) { continue; }
    if (se.insert(point)) { continue; }
    throw('Unable to redistribute all points!');
  }

  this.points = [];
  this.nw = nw;
  this.ne = ne;
  this.sw = sw;
  this.se = se;
}

GravTree.prototype.createChildTree = function(x0, y0, x1, y1) {
  return new GravTree({
    parent: this,
    depth:  this.depth + 1,
    x0:     x0,
    y0:     y0,
    x1:     x1,
    y1:     y1
  });
}


GravTree.prototype.insert = function(gtPoint) {
  if (!this.contains(gtPoint.x, gtPoint.y)) {
    return false;
  }

  this.invalidateCogCache();

  if (!this.nw &&
     ( this.depth == this.MAX_DEPTH ||
      (this.depth >= this.MIN_DEPTH &&
       this.points.length < this.MAX_CAPACITY))) {
    gtPoint.tree = this;
    this.points.push(gtPoint);
    return true;
  } else {
    if (!this.nw) { this.subdivide(); }

    if (this.nw.insert(gtPoint)) { return true; }
    if (this.ne.insert(gtPoint)) { return true; }
    if (this.sw.insert(gtPoint)) { return true; }
    if (this.se.insert(gtPoint)) { return true; }
  }
  throw('unable to add point!');
}

GravTree.prototype.invalidateCogCache = function() {
  if (this.cogCache) {
    this.m = 0;
    this.cogCache = false;
    if (this.parent) { this.parent.invalidateCogCache(); }
  }
}

GravTree.prototype.recalculateCog = function() {
  if (this.cogCache) { return; }

  var points;

  if (this.nw) {
    this.nw.recalculateCog();
    this.ne.recalculateCog();
    this.sw.recalculateCog();
    this.se.recalculateCog();
    points = [this.nw, this.ne, this.sw, this.se];
  } else {
    points = this.points;
  }

  var m = 0,
      x = 0,
      y = 0,
      im = 0,
      i,
      point,
      massRatio;

  if (points.length > 0) {
    for (i = 0; i < points.length; ++i) {
      m += points[i].m;
    }

    if (m > 0) {
      im = 1 / m;

      for (i = 0; i < points.length; ++i) {
        point = points[i];
        massRatio = point.m * im;
        x += point.x * massRatio;
        y += point.y * massRatio;
      }
    }
  }

  this.m = m;
  this.x = x;
  this.y = y;
  this.cogCache = true;
}

GravTree.prototype.pruneOrInvalidateCogCache = function() {
  if (!this.nw) { return; } // should never happen

  var nw = this.nw,
      ne = this.ne,
      sw = this.sw,
      se = this.se;

  if (!nw.nw && !ne.nw && !sw.nw && !se.nw) {
    var pts = nw.points.length +
              ne.points.length +
              sw.points.length +
              se.points.length;
    if (pts <= this.PRUNE_SIZE) {
      var i;

      this.nw = this.ne = this.sw = this.se = null;

      for (i = 0; i < nw.points.length; ++i) {
        if (!this.insert(nw.points[i])) { throw('unable to prune'); }
      }
      for (i = 0; i < ne.points.length; ++i) {
        if (!this.insert(ne.points[i])) { throw('unable to prune'); }
      }
      for (i = 0; i < sw.points.length; ++i) {
        if (!this.insert(sw.points[i])) { throw('unable to prune'); }
      }
      for (i = 0; i < se.points.length; ++i) {
        if (!this.insert(se.points[i])) { throw('unable to prune'); }
      }
    }
  }
  this.invalidateCogCache();
}

GravTree.prototype.remove = function(pt) {
  var i = this.points.indexOf(pt);

  if (i !== -1) {
    this.points[i] = this.points[this.points.length - 1];
    this.points.pop();
    if (this.points.length == 0) {
      this.cogCache = false;
      this.parent.pruneOrInvalidateCogCache();
    } else {
      this.invalidateCogCache();
    }
  } else {
    throw('unable to remove point');
  }
}

function GravTreePoint(x, y, m) {
  this.id = GravTreePoint.nextId++;
  this.x = x;
  this.y = y;
  this.m = m;

  this.fx = 0;
  this.fy = 0;

  this.ax = 0;
  this.ay = 0;

  this.vx = 0;
  this.vy = 0;
}

GravTreePoint.nextId = 0;

Simulation = function(opts) {
  this.points = [];
  this.rootTree = new GravTree({
    x0: opts.minX,
    y0: opts.minY,
    x1: opts.maxX,
    y1: opts.maxY,
    depth: 0,
  });
}

Simulation.prototype.addPoint = function(gtPoint) {
  this.points.push(gtPoint);
  if (!(this.rootTree.insert(gtPoint))) { throw('unable to add point'); }
}

Simulation.prototype.simulateStep = function(timeDelta) {
  var points = this.points;

  assignAccelerations(this.rootTree, {});

  for (var i = 0; i < points.length; ++i) {
    var point = points[i];

    point.ax = point.fx / point.m;
    point.ay = point.fy / point.m;

    point.vx += timeDelta * point.ax;
    point.vy += timeDelta * point.ay;

    point.x += timeDelta * point.vx;
    point.y += timeDelta * point.vy;

    if (!point.tree.contains(point.x, point.y)) {
      point.tree.remove(point);
      if (!this.rootTree.insert(point)) {
        points[i] = points[points.length - 1];
        points.pop();
      }
    } else {
      point.tree.invalidateCogCache();
    }
  }
}

var GRAV_CONST = 6.67e-11; // N * (m / kg) ^ 2

function calculateForce(point, other) {
  if (point.m < 0.0000001 || other.m < 0.0000001) { return [0, 0]; }

  var dx = (other.x - point.x),
      dy = (other.y - point.y);

  if (dx + dy > -0.001 &&
      dx + dy < 0.001) { return [0, 0]; }

  var dist = Math.sqrt(dx * dx + dy * dy);
      force = GRAV_CONST * point.m * other.m / dist;

  return [
    (dx / dist) * force,
    (dy / dist) * force
  ];
}

function calculateCachedForce(point, otherPoint, cache)  {
  var pointId = point.id,
      otherPointId = otherPoint.id,
      innerCache;

  if (pointId < otherPointId) {
    cache[pointId] = innerCache = cache[pointId] || {};
    if (!(force = innerCache[otherPointId])) {
      innerCache[otherPointId] = force = calculateForce(point, otherPoint);
    }
    return force;
  } else {
    cache[otherPointId] = innerCache = cache[otherPointId] || {};
    if (!(force = innerCache[pointId])) {
      innerCache[pointId] = force = calculateForce(otherPoint, point);
    }
    return [-force[0], -force[1]];
  }
}

function assignAccelerations(tree, savedPointForces, root) {
  root = root || tree;
  if (tree.nw) {
    // Only contains nested points
    if (tree.points.length > 0) { throw('wtf'); }
    assignAccelerations(tree.nw, savedPointForces, root);
    assignAccelerations(tree.ne, savedPointForces, root);
    assignAccelerations(tree.sw, savedPointForces, root);
    assignAccelerations(tree.se, savedPointForces, root);
  } else {
    var treePoints = tree.points,
        inRadiusNodes = collectInRadiusNodes(tree),
        outRadiusNodes = [],
        nodePoints,
        stack = [],
        point,
        node,
        fx = 0, fy = 0,
        force;

    // Mark and collect points
    for (var i = 0; i < inRadiusNodes.length; ++i) {
      node = inRadiusNodes[i];
      node.mark = 2; // do not pass
      node = node.parent;
      while (node) {
        if (node.mark) { break; }
        node.mark = 1; // scan for mark == 0 for cog calcs
        node = node.parent;
      };
    }

    // Collect all nodes outside of the point horizon
    // to perform COG calcs against
    if (root.mark !== 2) {
      stack = [root];
      while (stack.length > 0) {
        node = stack.pop();

        if (node.nw) {
          if (!node.nw.mark) { // cog
            outRadiusNodes.push(node.nw);
          } else if (node.nw.mark === 1) { //scan
            stack.push(node.nw);
          }

          if (!node.ne.mark) { // cog
            outRadiusNodes.push(node.ne);
          } else if (node.ne.mark === 1) { //scan
            stack.push(node.ne);
          }

          if (!node.sw.mark) { // cog
            outRadiusNodes.push(node.sw);
          } else if (node.sw.mark === 1){ //scan
            stack.push(node.sw);
          }

          if (!node.se.mark) { // cog
            outRadiusNodes.push(node.se);
          } else if (node.se.mark === 1) { //scan
            stack.push(node.se);
          }
        }
      }
    }

    for (var j = 0; j < treePoints.length; ++j) {
      point = treePoints[j];

      for (var k = 0; k < treePoints.length; ++k) {
        if (j === k) { continue; }
        force = calculateCachedForce(point, treePoints[k], savedPointForces);
        fx += force[0];
        fy += force[1];
      }

      // collect all points from in-point-horizon and calculate forces
      stack = inRadiusNodes.slice(0);
      while (stack.length > 0) {
        node = stack.pop();
        if (node.nw) { // dig again
          stack.push(node.nw);
          stack.push(node.ne);
          stack.push(node.sw);
          stack.push(node.se);
        } else { // calculate forces from points
          nodePoints = node.points;
          for (var k = 0; k < nodePoints.length; ++k) {
            force = calculateCachedForce(point, nodePoints[k], savedPointForces);
            fx += force[0];
            fy += force[1];
          }
        }
      }

      // calculate forces from cog of trees
      for (var i = 0; i < outRadiusNodes.length; ++i) {
        // ensure cache is up to date
        outRadiusNodes[i].recalculateCog();

        force = calculateForce(point, outRadiusNodes[i]);
        fx += force[0];
        fy += force[1];
      }

      point.fx = fx;
      point.fy = fy;
    }

    // Unmark
    for (var i = 0; i < inRadiusNodes.length; ++i) {
      node = inRadiusNodes[i];
      do {
        if (node.mark === null) { break; }
        node.mark = null;
        node = node.parent;
      } while (node);
    }
  }
}

function collectInRadiusNodes(node) {
  var northNode,
      northPath = [],

      westNode,
      westPath = [],

      southNode,
      southPath = [],

      eastNode,
      eastPath = [],

      parent,
      cur,
      dir,

      nodes = [];

  cur = node;
  parent = cur.parent;

  while (parent && (!northNode || !southNode || !westNode || !eastNode)) {
    if (cur === parent.sw) {
      dir = 'sw';
    } else if (cur === parent.nw) {
      dir = 'nw';
    } else if (cur === parent.ne) {
      dir = 'ne';
    } else if (cur === parent.se) {
      dir = 'se';
    }

    if (!northNode) {
      if (dir == 'sw') {
        northNode = parent.nw;
      } else if (dir == 'se') {
        northNode = parent.ne;
      } else if (dir == 'nw') {
        northPath.push('sw');
      } else if (dir == 'ne') {
        northPath.push('se');
      }
    }

    if (!southNode) {
      if (dir == 'nw') {
        southNode = parent.sw;
      } else if (dir == 'ne') {
        southNode = parent.se;
      } else if (dir == 'sw') {
        southPath.push('nw');
      } else if (dir == 'se') {
        southPath.push('ne');
      }
    }

    if (!eastNode) {
      if (dir == 'sw') {
        eastNode = parent.se;
      } else if (dir == 'nw') {
        eastNode = parent.ne;
      } else if (dir == 'ne') {
        eastPath.push('nw');
      } else if (dir == 'se') {
        eastPath.push('sw');
      }
    }

    if (!westNode) {
      if (dir == 'se') {
        westNode = parent.sw;
      } else if (dir == 'ne') {
        westNode = parent.nw;
      } else if (dir == 'nw') {
        westPath.push('ne');
      } else if (dir == 'sw') {
        westPath.push('se');
      }
    }

    cur = parent;
    parent = cur.parent;
  }

  if (northNode) {
    nodes = nodes.concat(walkAndCollectTwoSublevelNodes(northNode, northPath, 'sw', 'se'));
  }
  if (westNode) {
    nodes = nodes.concat(walkAndCollectTwoSublevelNodes(westNode, westPath, 'ne', 'se'));
  }
  if (southNode) {
    nodes = nodes.concat(walkAndCollectTwoSublevelNodes(southNode, southPath, 'nw', 'ne'));
  }
  if (eastNode) {
    nodes = nodes.concat(walkAndCollectTwoSublevelNodes(eastNode, eastPath, 'nw', 'sw'));
  }

  return nodes;
}

function walkAndCollectTwoSublevelNodes(node, path, subDir1, subDir2) {
  var i,
      dir,
      sub,
      subSub,
      nodes = [];

  for (i = path.length - 1; i >= 0; --i) {
    dir = path[i];
    if (node[dir]) {
      node = node[dir];
    } else {
      break;
    }
  }


  // TODO FIXME

  return [node];

  if (i == -1 && (sub = node[subDir1])) {
    nodes.push(node[subDir1]);
    if (subSub = sub[subDir1]) {
      nodes.push(subSub);
      nodes.push(sub[subDir2]); // guaranteed to exist
    } else {
      nodes.push(sub);
    }

    sub = node[subDir2]; // guaranteed to exist
    if (subSub = sub[subDir1]) {
      nodes.push(subSub);
      nodes.push(sub[subDir2]); // guaranteed to exist
    } else {
      nodes.push(sub);
    }
  } else {
    nodes.push(node);
  }

  return nodes;
}
