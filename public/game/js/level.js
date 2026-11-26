// The level as text. Row 0 is the top. One character is one 1x1 tile.
//   .  empty      #  solid block     o  coin
//   E  enemy      P  player start    F  goal flag
export const LEVEL_1 = [
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '.............................................................ooo................',
  '.............oo...................ooo.......................#####...............',
  '......ooo...####...............#.................o..............................',
  '..P.......#.......E...........##....E.....#.............#.....E.....#......F....',
  '########################...##################...###...##########################',
  '########################...##################.........##########################',
];

// Turns the text rows into data. All positions are tile coordinates with
// x to the right and y UP, so y = 0 is the bottom row of the text.
export function parseLevel(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const solid = [];
  const coins = [];
  const enemies = [];
  let player = null;
  let flag = null;

  for (let y = 0; y < height; y++) {
    const row = rows[height - 1 - y];
    if (row.length !== width) {
      throw new Error(`Level row ${height - 1 - y} has length ${row.length}, expected ${width}`);
    }
    solid.push([]);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      solid[y].push(ch === '#');
      if (ch === 'o') coins.push({ x, y });
      else if (ch === 'E') enemies.push({ x, y });
      else if (ch === 'P') {
        if (player) throw new Error('Level has more than one player start (P)');
        player = { x, y };
      } else if (ch === 'F') {
        if (flag) throw new Error('Level has more than one flag (F)');
        flag = { x, y };
      } else if (ch !== '.' && ch !== '#') {
        throw new Error(`Level has unknown character "${ch}" at column ${x}, row ${height - 1 - y}`);
      }
    }
  }
  if (!player) throw new Error('Level has no player start (P)');
  if (!flag) throw new Error('Level has no flag (F)');
  return { width, height, solid, coins, enemies, player, flag };
}

// Left and right of the level counts as solid, so nothing can walk out.
// Below and above the level is empty, so pits are open.
export function isSolid(level, tx, ty) {
  if (tx < 0 || tx >= level.width) return true;
  if (ty < 0 || ty >= level.height) return false;
  return level.solid[ty][tx];
}
