use rand::{rngs::StdRng, Rng, SeedableRng};

#[derive(Clone, Debug)]
pub struct ZobristTable {
    stones: Vec<[u64; 2]>,
    to_move: [u64; 2],
}

impl ZobristTable {
    pub fn new(size: usize) -> Self {
        let mut rng = StdRng::seed_from_u64(0xC0FF_EE00_D15C_A11E);
        let intersections = size * size;
        let mut stones = Vec::with_capacity(intersections);
        for _ in 0..intersections {
            stones.push([rng.gen(), rng.gen()]);
        }

        let to_move = [rng.gen(), rng.gen()];

        Self { stones, to_move }
    }

    #[inline]
    pub fn stone(&self, index: usize, color_index: usize) -> u64 {
        self.stones[index][color_index]
    }

    #[inline]
    pub fn to_move(&self, color_index: usize) -> u64 {
        self.to_move[color_index]
    }
}
