import type { ParticleType } from './celebrate'

// Static brand markup without user data, so innerHTML is safe here (design/src/motion/celebrate.ts)
const BITE_SVG =
	'<svg width="100%" height="100%" viewBox="0 0 100 100"><defs><linearGradient id="kpg" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stop-color="#FFB877"/><stop offset="1" stop-color="#D45F22"/></linearGradient><mask id="kpm"><rect width="100" height="100" fill="#fff"/><circle cx="91" cy="31" r="10" fill="#000"/><circle cx="83" cy="18" r="10" fill="#000"/><circle cx="70" cy="10" r="9.5" fill="#000"/></mask></defs><circle cx="50" cy="50" r="42" fill="url(#kpg)" mask="url(#kpm)"/></svg>'

const getStarSvg = (color: string): string =>
	`<svg width="100%" height="100%" viewBox="0 0 20 20"><path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6Z" fill="${color}"/></svg>`

const PARTICLE_STYLE: Record<ParticleType, (color: string) => string> = {
	dot: (color) => `width:7px;height:7px;border-radius:50%;background:${color}`,
	line: (color) => `width:12px;height:3px;border-radius:2px;background:${color}`,
	ring: (color) => `width:11px;height:11px;border-radius:50%;border:2px solid ${color}`,
	bite: () => 'width:14px;height:14px',
	star: () => 'width:12px;height:12px',
}

/** Position and pointer-events come from .k-particle in motion.css. */
export const createParticle = (type: ParticleType, color: string): HTMLSpanElement => {
	const particle = document.createElement('span')
	particle.className = 'k-particle'
	particle.setAttribute('aria-hidden', 'true')
	particle.style.cssText += PARTICLE_STYLE[type](color)
	if (type === 'bite') particle.innerHTML = BITE_SVG
	if (type === 'star') particle.innerHTML = getStarSvg(color)
	return particle
}
