use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Point {
    pub x: u8,
    pub y: u8,
}

impl Point {
    pub fn new(x: usize, y: usize) -> Result<Self, String> {
        if x > u8::MAX as usize || y > u8::MAX as usize {
            return Err("coordinate out of range".into());
        }
        Ok(Self {
            x: x as u8,
            y: y as u8,
        })
    }

    #[inline]
    pub fn to_index(self, size: usize) -> usize {
        (self.y as usize) * size + (self.x as usize)
    }

    #[inline]
    pub fn from_index(idx: usize, size: usize) -> Self {
        let x = (idx % size) as u8;
        let y = (idx / size) as u8;
        Self { x, y }
    }
}
