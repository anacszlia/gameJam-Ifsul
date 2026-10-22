var LEVELS = [
  {
    id: 1,
    name: "Orvalho",
    hint: "WASD anda. Clique cura. Não pise na mancha.",
    goal: "cure-all",
    radiationLimit: 100,
    pressure: 1,
    time: 0,
    spawns: [{ tier: 1, count: 3, speed: 96 }]
  },
  {
    id: 2,
    name: "Encontro",
    hint: "Eles te seguem. Dois iguais evoluem ao encostar.",
    goal: "cure-all",
    radiationLimit: 100,
    pressure: 0.55,
    time: 0,
    spawns: [{ tier: 1, count: 6, speed: 128 }]
  },
  {
    id: 3,
    name: "Broto",
    hint: "O grande precisa de dois frascos.",
    goal: "cure-all",
    radiationLimit: 100,
    pressure: 0.6,
    time: 0,
    spawns: [
      { tier: 2, count: 1, speed: 112 },
      { tier: 1, count: 4, speed: 120 }
    ]
  },
  {
    id: 4,
    name: "Contenção",
    hint: "Eles vêm até você. Não deixe os grandes se fundirem.",
    goal: "hold",
    radiationLimit: 100,
    pressure: 0.26,
    time: 24,
    spawns: [
      { tier: 3, x: 0.16, y: 0.5, speed: 72 },
      { tier: 3, x: 0.84, y: 0.5, speed: 72 },
      { tier: 1, x: 0.38, y: 0.26, speed: 96 },
      { tier: 1, x: 0.62, y: 0.74, speed: 96 }
    ]
  },
  {
    id: 5,
    name: "Estufa",
    hint: "Cure a estufa antes que a mancha feche.",
    goal: "cure-all",
    radiationLimit: 100,
    pressure: 0.36,
    time: 0,
    spawns: [
      { tier: 2, count: 2, speed: 118 },
      { tier: 1, count: 6, speed: 130 }
    ]
  }
];
