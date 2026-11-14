const patterns = [
  {
    name: 'The Plough',
    weight: 9,
    points: [[-.49, -.11], [-.32, -.14], [-.14, -.05], [.03, .07], [.16, .23], [.42, .19], [.47, -.07]],
    paths: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  {
    name: 'Cassiopeia',
    weight: 8,
    points: [[-.48, -.17], [-.24, .14], [0, -.10], [.25, .22], [.47, .02]],
    paths: [[0, 1, 2, 3, 4]],
  },
  {
    name: 'Little Dipper',
    weight: 3,
    points: [[-.46, -.24], [-.28, -.10], [-.09, -.08], [.08, .02], [.17, .22], [.43, .18], [.36, -.04]],
    paths: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  {
    name: 'Orion',
    weight: 10,
    peakMonth: 0,
    points: [[-.33, -.36], [.30, -.32], [-.10, -.46], [-.10, -.07], [0, -.02], [.11, .02], [-.26, .37], [.32, .43], [.05, .20]],
    paths: [[0, 2, 1, 5, 7, 6, 3, 0], [3, 4, 5], [4, 8]],
  },
  {
    name: 'Cygnus',
    weight: 7,
    peakMonth: 8,
    points: [[.17, -.45], [.05, -.08], [-.04, .13], [-.18, .44], [-.43, -.23], [-.26, -.17], [.29, .01], [.47, .15]],
    paths: [[0, 1, 2, 3], [4, 5, 1, 6, 7]],
  },
  {
    name: 'Leo',
    weight: 6,
    peakMonth: 3,
    points: [[.16, .16], [.28, -.06], [.48, -.18], [.39, -.37], [.22, -.38], [.10, -.23], [-.18, -.12], [-.47, .11], [-.11, .20]],
    paths: [[0, 1, 2, 3, 4, 5], [0, 1, 6, 7, 8, 6], [8, 0]],
  },
  {
    name: 'Delphinus',
    weight: 1,
    peakMonth: 8,
    points: [[.37, -.35], [.05, -.47], [-.19, -.13], [.10, -.02], [-.40, .42]],
    paths: [[0, 1, 2, 3, 0], [2, 4]],
  },
];

export function createConstellations(month = new Date().getUTCMonth(), random = Math.random) {
  const roll = random();
  const count = roll < .25 ? 0 : roll < .80 ? 1 : 2;
  if (!count) return [];

  const candidates = patterns.map(pattern => {
    if (pattern.peakMonth === undefined) return { pattern, weight: pattern.weight };
    const difference = Math.abs(month - pattern.peakMonth);
    const monthsFromPeak = Math.min(difference, 12 - difference);
    return { pattern, weight: pattern.weight * Math.max(0, 1 - monthsFromPeak / 4) };
  }).filter(candidate => candidate.weight > 0);

  const firstSide = random() < .5 ? -1 : 1;
  return Array.from({ length: count }, (_, index) => {
    const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let ticket = random() * total;
    const selected = candidates.findIndex(candidate => (ticket -= candidate.weight) < 0);
    const [{ pattern }] = candidates.splice(selected, 1);
    const side = index === 0 ? firstSide : -firstSide;
    return {
      ...pattern,
      x: .5 + side * (.18 + random() * .09),
      y: .13 + random() * .08,
      rotation: (random() - .5) * .55,
    };
  });
}

export function drawConstellations(context, constellations, width, height, time, pointer, topLimit) {
  const size = Math.min(104, width * .22, height * .19);
  for (const pattern of constellations) {
    const x = pattern.x * width;
    const y = Math.min(pattern.y * height, topLimit);
    const distance = pointer?.active ? Math.hypot(x - pointer.x, y - pointer.y) : Infinity;
    const highlight = Math.max(0, 1 - distance / (size * .8));

    context.save();
    context.translate(x, y);
    context.rotate(pattern.rotation);
    context.strokeStyle = `rgba(255,191,71,${.19 + highlight * .32})`;
    context.lineWidth = .8;
    context.beginPath();
    for (const [first, ...rest] of pattern.paths) {
      const [startX, startY] = pattern.points[first];
      context.moveTo(startX * size, startY * size);
      for (const point of rest) {
        const [pointX, pointY] = pattern.points[point];
        context.lineTo(pointX * size, pointY * size);
      }
    }
    context.stroke();

    pattern.points.forEach(([pointX, pointY], index) => {
      const pulse = .06 * Math.sin(time * .85 + index * 1.7);
      context.fillStyle = `rgba(255,226,180,${.6 + pulse + highlight * .28})`;
      context.beginPath();
      context.arc(pointX * size, pointY * size, index === 0 ? 1.75 : 1.35, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  }
}
