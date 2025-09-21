import type { PointPayload, StoneColor } from "../lib/rules";

export interface GoBoardProps {
  size: number;
  intersections: Array<StoneColor | null>;
  lastMove?: PointPayload | null;
  disabled?: boolean;
  onPlay?: (point: PointPayload) => void;
  canPlay?: (point: PointPayload) => boolean;
}

export function GoBoard({ size, intersections, lastMove, disabled, onPlay, canPlay }: GoBoardProps) {
  const handleClick = (x: number, y: number) => {
    if (disabled || !onPlay) return;
    const point = { x, y };
    if (canPlay && !canPlay(point)) {
      return;
    }
    onPlay(point);
  };

  const cellSize = 32;

  return (
    <div
      className="go-board"
      style={{
        width: cellSize * size,
        height: cellSize * size,
        gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: size * size }).map((_, index) => {
        const x = index % size;
        const y = Math.floor(index / size);
        const stone = intersections[index];
        const isLast = lastMove && lastMove.x === x && lastMove.y === y;
        const playable = canPlay ? canPlay({ x, y }) : true;

        return (
          <button
            key={`${x}-${y}`}
            type="button"
            className={`go-board__cell${stone ? ` is-${stone}` : ""}${isLast ? " is-last" : ""}${!stone && playable ? " is-playable" : ""}`}
            onClick={() => handleClick(x, y)}
            disabled={disabled || stone !== null || (canPlay ? !playable : false)}
            aria-label={`Cell ${x + 1},${y + 1}`}
          >
            <span className="go-board__hoshi" data-hoshi={Number(shouldShowHoshi(size, x, y))} />
            {stone && (
              <span className="go-board__stone" data-color={stone} data-last={Number(isLast)} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function shouldShowHoshi(size: number, x: number, y: number): boolean {
  if (size < 7) return false;
  const hoshi = hoshiPoints(size);
  return hoshi.some((pt) => pt.x === x && pt.y === y);
}

function hoshiPoints(size: number): PointPayload[] {
  const edge = size - 1;
  const offsets = size >= 13 ? [3, edge - 3] : size >= 9 ? [2, edge - 2] : [Math.floor(edge / 2)];
  const points: PointPayload[] = [];
  for (const x of offsets) {
    for (const y of offsets) {
      points.push({ x, y });
    }
  }
  if (size % 2 === 1 && size !== 7) {
    const mid = Math.floor(edge / 2);
    points.push({ x: mid, y: mid });
  }
  return points;
}
