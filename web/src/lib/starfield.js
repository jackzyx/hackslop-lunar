export function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(), y: Math.random(), depth: .25 + Math.random() * .75,
    phase: Math.random() * Math.PI * 2, radius: .5 + Math.random() * 1.1,
    offsetX: 0, offsetY: 0,
  }));
}

export function drawStars(context, stars, width, height, time, dt = 1 / 60, pointer = null, still = false) {
  const follow = 1 - Math.exp(-8 * Math.min(dt, .05));
  let links = 0;
  for (const star of stars) {
    const x = ((star.x * width + (still ? 0 : time * (1 + star.depth * 2))) % width + width) % width;
    const y = star.y * height + (still ? 0 : Math.sin(time * .15 + star.phase) * 7 * star.depth);
    const dx = x - (pointer?.x ?? -1000), dy = y - (pointer?.y ?? -1000);
    const distance = Math.hypot(dx, dy), influence = pointer?.active ? Math.max(0, 1 - distance / 170) : 0;
    const push = influence * influence * 22 * star.depth;
    star.offsetX += ((distance ? dx / distance * push : 0) - star.offsetX) * follow;
    star.offsetY += ((distance ? dy / distance * push : 0) - star.offsetY) * follow;
    const px = x + star.offsetX, py = y + star.offsetY;
    const twinkle = still ? .7 : .65 + .35 * Math.sin(time * (.55 + star.depth * .4) + star.phase);
    context.fillStyle = `rgba(255,226,180,${.15 + .45 * star.depth * twinkle + influence * .3})`;
    context.beginPath(); context.arc(px, py, star.radius, 0, Math.PI * 2); context.fill();
    if (influence > .15 && links++ < 8) {
      context.strokeStyle = `rgba(255,176,0,${influence * .12})`;
      context.lineWidth = .5;
      context.beginPath(); context.moveTo(px, py); context.lineTo(pointer.x, pointer.y); context.stroke();
    }
  }
}
