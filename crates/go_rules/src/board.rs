use std::sync::Arc;

use crate::{color::Color, error::RuleViolation, point::Point, zobrist::ZobristTable};

#[derive(Clone, Debug)]
pub struct Board {
    size: usize,
    cells: Vec<Option<Color>>,
    zobrist: Arc<ZobristTable>,
    hash: u64,
}

#[derive(Debug)]
pub struct GroupInfo {
    pub stones: Vec<usize>,
    pub liberties: Vec<usize>,
}

impl Board {
    pub fn new(size: usize) -> Self {
        let zobrist = Arc::new(ZobristTable::new(size));
        let cells = vec![None; size * size];
        Self {
            size,
            cells,
            zobrist,
            hash: 0,
        }
    }

    #[inline]
    pub fn size(&self) -> usize {
        self.size
    }

    #[inline]
    pub fn hash(&self) -> u64 {
        self.hash
    }

    #[inline]
    pub fn position_key(&self, to_move: Color) -> u64 {
        self.hash ^ self.zobrist.to_move(to_move.index())
    }

    #[inline]
    pub fn get(&self, point: Point) -> Option<Color> {
        self.cells[point.to_index(self.size)]
    }

    #[inline]
    pub fn is_empty(&self, point: Point) -> bool {
        self.get(point).is_none()
    }

    pub fn set(&mut self, index: usize, color: Option<Color>) {
        if let Some(current) = self.cells[index] {
            self.hash ^= self.zobrist.stone(index, current.index());
        }
        if let Some(new_color) = color {
            self.hash ^= self.zobrist.stone(index, new_color.index());
        }
        self.cells[index] = color;
    }

    pub fn after_play(
        &self,
        color: Color,
        point: Point,
    ) -> Result<(Self, Vec<Point>), RuleViolation> {
        let index = point.to_index(self.size);
        if index >= self.cells.len() {
            return Err(RuleViolation::OutOfBounds { point });
        }
        if self.cells[index].is_some() {
            return Err(RuleViolation::Occupied { point });
        }

        let mut next = self.clone();
        next.set(index, Some(color));

        let neighbors: Vec<usize> = self.neighbors(index).collect();
        let mut captured_points: Vec<Point> = Vec::new();
        for neighbor in neighbors {
            if let Some(stone_color) = next.cells[neighbor] {
                if stone_color == color {
                    continue;
                }
                let group = next.group_at(neighbor);
                if group.liberties.is_empty() {
                    for stone_idx in group.stones {
                        next.set(stone_idx, None);
                        captured_points.push(Point::from_index(stone_idx, next.size));
                    }
                }
            }
        }

        let own_group = next.group_at(index);
        if own_group.liberties.is_empty() {
            return Err(RuleViolation::Suicide { point });
        }

        Ok((next, captured_points))
    }

    pub fn group_at(&self, start: usize) -> GroupInfo {
        let color = match self.cells[start] {
            Some(color) => color,
            None => {
                return GroupInfo {
                    stones: Vec::new(),
                    liberties: Vec::new(),
                }
            }
        };

        let mut stack = vec![start];
        let mut visited = vec![false; self.cells.len()];
        visited[start] = true;
        let mut stones = Vec::new();
        let mut liberties = Vec::new();

        while let Some(index) = stack.pop() {
            stones.push(index);
            for neighbor in self.neighbors(index) {
                match self.cells[neighbor] {
                    Some(neighbor_color) if neighbor_color == color => {
                        if !visited[neighbor] {
                            visited[neighbor] = true;
                            stack.push(neighbor);
                        }
                    }
                    Some(_) => {}
                    None => {
                        if !visited[neighbor] {
                            visited[neighbor] = true;
                            liberties.push(neighbor);
                        }
                    }
                }
            }
        }

        GroupInfo { stones, liberties }
    }

    pub fn territory_map(&self) -> Vec<Option<Color>> {
        let mut owner: Vec<Option<Color>> = vec![None; self.cells.len()];
        let mut visited = vec![false; self.cells.len()];

        for index in 0..self.cells.len() {
            if self.cells[index].is_some() || visited[index] {
                continue;
            }

            let mut queue = vec![index];
            visited[index] = true;
            let mut empties = Vec::new();
            let mut bordering_colors = Vec::new();

            while let Some(current) = queue.pop() {
                empties.push(current);
                for neighbor in self.neighbors(current) {
                    match self.cells[neighbor] {
                        Some(color) => {
                            if !bordering_colors.contains(&color) {
                                bordering_colors.push(color);
                            }
                        }
                        None => {
                            if !visited[neighbor] {
                                visited[neighbor] = true;
                                queue.push(neighbor);
                            }
                        }
                    }
                }
            }

            if bordering_colors.len() == 1 {
                let color = bordering_colors[0];
                for idx in empties {
                    owner[idx] = Some(color);
                }
            }
        }

        owner
    }

    pub fn intersections(&self) -> &[Option<Color>] {
        &self.cells
    }

    pub fn neighbors(&self, index: usize) -> impl Iterator<Item = usize> + '_ {
        let x = index % self.size;
        let y = index / self.size;
        let size = self.size;
        let mut neighbors = Vec::with_capacity(4);
        if x > 0 {
            neighbors.push(index - 1);
        }
        if x + 1 < size {
            neighbors.push(index + 1);
        }
        if y > 0 {
            neighbors.push(index - size);
        }
        if y + 1 < size {
            neighbors.push(index + size);
        }
        neighbors.into_iter()
    }
}
