export const levels = Object.freeze([
  {
    id: 'goose-green-awakening',
    name: 'The Great Goose Green Adventure',
    width: 9600,
    height: 1250,
    spawn: { x: 260, y: 760 },
    exit: { x: 9340, y: 805, width: 118, height: 190 },
    requiredCrystals: 3,
    platforms: [
      // Windmill Meadow
      { x: 0, y: 920, width: 1500, height: 330, type: 'grass' },
      { x: 420, y: 760, width: 250, height: 28, type: 'bridge' },
      { x: 780, y: 670, width: 210, height: 28, type: 'cloud' },
      { x: 1080, y: 790, width: 260, height: 28, type: 'moving', moveY: 95, speed: 1.25 },
      { x: 1360, y: 850, width: 130, height: 28, type: 'trampoline' },

      // Cloudstep Crossing
      { x: 1650, y: 950, width: 1150, height: 300, type: 'grass' },
      { x: 1760, y: 820, width: 170, height: 28, type: 'trampoline' },
      { x: 1980, y: 650, width: 230, height: 26, type: 'cloud' },
      { x: 2260, y: 500, width: 220, height: 26, type: 'moving', moveX: 115, moveY: 45, speed: 1.05 },
      { x: 2560, y: 350, width: 260, height: 26, type: 'cloud' },
      { x: 2700, y: 720, width: 120, height: 28, type: 'trampoline' },
      { x: 2870, y: 610, width: 190, height: 28, type: 'bridge' },

      // Whispering Ruins
      { x: 2950, y: 900, width: 1050, height: 350, type: 'ruin' },
      { x: 3150, y: 710, width: 260, height: 30, type: 'ruin' },
      { x: 3490, y: 590, width: 190, height: 28, type: 'moving', moveY: 150, speed: 1.45 },
      { x: 3770, y: 730, width: 220, height: 28, type: 'ruin' },
      { x: 3970, y: 810, width: 110, height: 28, type: 'trampoline' },

      // Moonwater Ravine
      { x: 4200, y: 980, width: 1000, height: 270, type: 'grass' },
      { x: 4230, y: 760, width: 190, height: 26, type: 'cloud' },
      { x: 4510, y: 610, width: 210, height: 26, type: 'moving', moveX: 130, speed: 1.15 },
      { x: 4800, y: 760, width: 250, height: 28, type: 'bridge' },
      { x: 5150, y: 860, width: 150, height: 28, type: 'trampoline' },
      { x: 5320, y: 690, width: 190, height: 26, type: 'cloud' },

      // Lantern Woods
      { x: 5500, y: 920, width: 1000, height: 330, type: 'grass' },
      { x: 5660, y: 730, width: 230, height: 28, type: 'bridge' },
      { x: 5980, y: 590, width: 200, height: 28, type: 'moving', moveY: 120, speed: 1.3 },
      { x: 6250, y: 760, width: 200, height: 28, type: 'cloud' },
      { x: 6450, y: 850, width: 120, height: 28, type: 'trampoline' },
      { x: 6620, y: 650, width: 190, height: 28, type: 'cloud' },

      // Bread Fox Pass
      { x: 6800, y: 970, width: 900, height: 280, type: 'ruin' },
      { x: 6960, y: 790, width: 230, height: 30, type: 'ruin' },
      { x: 7280, y: 650, width: 210, height: 28, type: 'moving', moveX: 120, speed: 1.4 },
      { x: 7540, y: 800, width: 180, height: 28, type: 'trampoline' },
      { x: 7750, y: 610, width: 230, height: 28, type: 'bridge' },

      // Foxfire Fortress
      { x: 8000, y: 900, width: 1600, height: 350, type: 'fortress' },
      { x: 8070, y: 710, width: 270, height: 30, type: 'ruin' },
      { x: 8430, y: 600, width: 240, height: 28, type: 'moving', moveY: 120, speed: 1.2 },
      { x: 8750, y: 720, width: 260, height: 30, type: 'ruin' },
      { x: 9050, y: 820, width: 180, height: 28, type: 'trampoline' },
    ],
    hazards: [
      { x: 1500, y: 930, width: 150, height: 320, type: 'water' },
      { x: 2800, y: 920, width: 150, height: 330, type: 'water' },
      { x: 4000, y: 930, width: 200, height: 320, type: 'thorns' },
      { x: 5200, y: 930, width: 300, height: 320, type: 'water' },
      { x: 6500, y: 930, width: 300, height: 320, type: 'thorns' },
      { x: 7700, y: 930, width: 300, height: 320, type: 'water' },
    ],
    checkpoints: [
      { id: 'cloudstep', x: 1910, y: 872, label: 'Cloudstep Post' },
      { id: 'moonwater', x: 4920, y: 902, label: 'Moonwater Post' },
      { id: 'fox-pass', x: 7160, y: 892, label: 'Fox Pass Post' },
    ],
    crystals: [
      { id: 'meadow', x: 1410, y: 760, radius: 250, label: 'Meadow Echo' },
      { id: 'ravine', x: 4910, y: 640, radius: 260, label: 'Moonwater Echo' },
      { id: 'fortress', x: 7860, y: 500, radius: 270, label: 'Foxfire Echo' },
    ],
    scenery: [
      { x: 160, y: 910, type: 'tree', scale: 1.2 }, { x: 1040, y: 910, type: 'tree', scale: 0.9, flip: true },
      { x: 620, y: 915, type: 'sign', label: 'HONK HILL →' }, { x: 1260, y: 915, type: 'mushroom', scale: 1.2 },
      { x: 1890, y: 945, type: 'sign', label: 'TRIPLE FLAP!' }, { x: 2390, y: 945, type: 'tree', scale: 0.8 },
      { x: 3090, y: 895, type: 'ruin', scale: 1.15 }, { x: 3860, y: 895, type: 'ruin', scale: 0.9, flip: true },
      { x: 4390, y: 975, type: 'mushroom', scale: 1.4 }, { x: 5060, y: 975, type: 'sign', label: 'MOONWATER' },
      { x: 5600, y: 915, type: 'tree', scale: 1.15 }, { x: 6140, y: 915, type: 'tree', scale: 1.05, flip: true },
      { x: 6890, y: 965, type: 'sign', label: 'FOX PASS' }, { x: 7480, y: 965, type: 'ruin', scale: 1.05 },
      { x: 8150, y: 895, type: 'ruin', scale: 1.3 }, { x: 8900, y: 895, type: 'sign', label: 'HONK TO OPEN' },
    ],
    collectibles: [
      { x: 430, y: 680 }, { x: 610, y: 650 }, { x: 820, y: 580 }, { x: 1120, y: 620 }, { x: 1390, y: 700 },
      { x: 1810, y: 740 }, { x: 2040, y: 570 }, { x: 2330, y: 420 }, { x: 2630, y: 270 }, { x: 2890, y: 530 },
      { x: 3150, y: 630 }, { x: 3380, y: 760 }, { x: 3540, y: 500 }, { x: 3820, y: 650 }, { x: 4050, y: 710 },
      { x: 4300, y: 680 }, { x: 4560, y: 530 }, { x: 4830, y: 680 }, { x: 5160, y: 780 }, { x: 5370, y: 610 },
      { x: 5650, y: 650 }, { x: 5880, y: 740 }, { x: 6030, y: 500 }, { x: 6300, y: 680 }, { x: 6660, y: 570 },
      { x: 6970, y: 710 }, { x: 7330, y: 560 }, { x: 7580, y: 720 }, { x: 7830, y: 520 }, { x: 8110, y: 620 },
      { x: 8460, y: 510 }, { x: 8780, y: 630 }, { x: 9100, y: 740 }, { x: 9320, y: 660 },
    ],
    enemies: [
      { id: 'meadow-scout', x: 980, y: 850, patrol: 180, rank: 'scout' },
      { id: 'cloud-guard', x: 2390, y: 860, patrol: 240, rank: 'guard' },
      { id: 'ruin-scout', x: 3310, y: 820, patrol: 190, rank: 'scout' },
      { id: 'ravine-guard', x: 4670, y: 900, patrol: 230, rank: 'guard' },
      { id: 'woods-scout', x: 5880, y: 840, patrol: 220, rank: 'scout' },
      { id: 'pass-guard', x: 7050, y: 880, patrol: 190, rank: 'guard' },
      { id: 'fortress-guard', x: 8350, y: 820, patrol: 210, rank: 'guard' },
      { id: 'bread-captain', x: 8870, y: 800, patrol: 300, rank: 'captain', name: 'Captain Crust' },
    ],
    story: [
      { x: 360, text: 'Goose Green is awake—and the Bread Foxes stole the three Echo Crystals.' },
      { x: 1120, text: 'Press H / B to HONK. Echo Crystals remember every honk in the shared flock.' },
      { x: 1720, text: 'Triple-jump! The third flap briefly lightens gravity so you can sail through the sky.' },
      { x: 3000, text: 'The Whispering Ruins hide moving paths, fox patrols, and forgotten crumb trails.' },
      { x: 4230, text: 'Moonwater Ravine rewards height. Hold jump after the third flap to glide farther.' },
      { x: 5580, text: 'Another goose nearby? Press E / Y for a wing-bump—and try honking them airborne.' },
      { x: 6820, text: 'Bread Fox Pass is guarded. Foxes now chase, wind up, charge, and recover.' },
      { x: 8040, text: 'Foxfire Fortress opens after the crystals awaken and your personal Echo Layer is ready to evolve.' },
      { x: 8750, text: 'Every crumb, fox, crystal, and wing-bump feeds the shared Flock Energy meter. When it fills, Baron Breadstorm attacks.' },
      { x: 9180, text: 'The golden gate does not end the adventure—it remixes Goose Green into your next evolving Echo Layer.' },
    ],
  },
]);
