export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLE = 4;
export const PLANKS = 5;
export const LOG = 6;
export const LEAVES = 7;
export const GLASS = 8;
export const WATER = 9;
export const BRICKS = 10;
export const SAND = 11;
export const BEDROCK = 12;

export const BLOCKS = {
  [GRASS]: { name: 'Grass', top: 'grass_top', side: 'grass_side', bottom: 'dirt', icon: 'grass_side', solid: true, opaque: true },
  [DIRT]: { name: 'Dirt', top: 'dirt', side: 'dirt', bottom: 'dirt', icon: 'dirt', solid: true, opaque: true },
  [STONE]: { name: 'Stone', top: 'stone', side: 'stone', bottom: 'stone', icon: 'stone', solid: true, opaque: true },
  [COBBLE]: { name: 'Cobblestone', top: 'cobble', side: 'cobble', bottom: 'cobble', icon: 'cobble', solid: true, opaque: true },
  [PLANKS]: { name: 'Planks', top: 'planks', side: 'planks', bottom: 'planks', icon: 'planks', solid: true, opaque: true },
  [LOG]: { name: 'Log', top: 'log_top', side: 'log_side', bottom: 'log_top', icon: 'log_side', solid: true, opaque: true },
  [LEAVES]: { name: 'Leaves', top: 'leaves', side: 'leaves', bottom: 'leaves', icon: 'leaves', solid: true, opaque: false },
  [GLASS]: { name: 'Glass', top: 'glass', side: 'glass', bottom: 'glass', icon: 'glass', solid: true, opaque: false },
  [WATER]: { name: 'Water', top: 'water', side: 'water', bottom: 'water', icon: 'water', solid: false, opaque: false },
  [BRICKS]: { name: 'Bricks', top: 'bricks', side: 'bricks', bottom: 'bricks', icon: 'bricks', solid: true, opaque: true },
  [SAND]: { name: 'Sand', top: 'sand', side: 'sand', bottom: 'sand', icon: 'sand', solid: true, opaque: true },
  [BEDROCK]: { name: 'Bedrock', top: 'bedrock', side: 'bedrock', bottom: 'bedrock', icon: 'bedrock', solid: true, opaque: true },
};

export const isSolid = (id) => !!id && !!BLOCKS[id]?.solid;
export const isOpaque = (id) => !!id && !!BLOCKS[id]?.opaque;
export const isWater = (id) => id === WATER;
export const isTransparent = (id) => !!id && !BLOCKS[id].opaque;

export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICKS, LEAVES, SAND];
