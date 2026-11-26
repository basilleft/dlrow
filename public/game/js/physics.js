// Collision maths. A "box" is { x, y, w, h } where (x, y) is its bottom-left
// corner, y points up, and one unit is one tile.

const EPS = 1e-6;

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Moves the box by (dx, dy), stopping at solid tiles. Changes box.x and box.y.
// solidAt(tx, ty) must return true for solid tiles.
// Each move must be shorter than one tile, which holds at 60 steps per second.
export function moveBox(box, dx, dy, solidAt) {
  const hit = { left: false, right: false, floor: false, ceiling: false };

  if (dx !== 0) {
    box.x += dx;
    const y0 = Math.floor(box.y + EPS);
    const y1 = Math.floor(box.y + box.h - EPS);
    const tx = dx > 0 ? Math.floor(box.x + box.w - EPS) : Math.floor(box.x + EPS);
    for (let ty = y0; ty <= y1; ty++) {
      if (!solidAt(tx, ty)) continue;
      if (dx > 0) { box.x = tx - box.w; hit.right = true; }
      else { box.x = tx + 1; hit.left = true; }
      break;
    }
  }

  if (dy !== 0) {
    box.y += dy;
    const x0 = Math.floor(box.x + EPS);
    const x1 = Math.floor(box.x + box.w - EPS);
    const ty = dy > 0 ? Math.floor(box.y + box.h - EPS) : Math.floor(box.y + EPS);
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(tx, ty)) continue;
      if (dy > 0) { box.y = ty - box.h; hit.ceiling = true; }
      else { box.y = ty + 1; hit.floor = true; }
      break;
    }
  }

  return hit;
}
