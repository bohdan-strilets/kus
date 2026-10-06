import { animate } from 'motion'

import type { BurstConfig } from './celebrate'
import { createParticle } from './particle'
import { prefersReducedMotion } from './prefers-reduced-motion'
import { EASE } from './transition'

const getAngle = (config: BurstConfig, index: number): number => {
	if (config.spread) {
		const [from, to] = config.spread
		return from + Math.random() * (to - from)
	}
	return (index / config.count) * Math.PI * 2 + Math.random() * 0.4
}

/**
 * Particles fly out of point (x, y) relative to `host` (host needs position: relative and
 * overflow: visible). Skipped entirely under reduced motion.
 */
export const burst = (host: HTMLElement, x: number, y: number, config: BurstConfig): void => {
	if (prefersReducedMotion()) return

	for (let index = 0; index < config.count; index++) {
		const type = config.types[index % config.types.length] ?? 'dot'
		const color = config.colors[index % config.colors.length] ?? ''
		const particle = createParticle(type, color)
		host.appendChild(particle)

		const angle = getAngle(config, index)
		const distance = config.distancePx * (0.65 + Math.random() * 0.5)
		const dx = Math.cos(angle) * distance
		const dy = Math.sin(angle) * distance
		const rotation = type === 'line' ? (angle * 180) / Math.PI : Math.random() * 240 - 120
		const origin = `translate(${x}px,${y}px) translate(-50%,-50%) `
		const duration = (config.durationMs * (0.8 + Math.random() * 0.4)) / 1000

		const keyframes = config.gravityPx
			? {
					transform: [
						`${origin}translate(0,0) scale(.3) rotate(0deg)`,
						`${origin}translate(${dx * 0.8}px,${dy - 20}px) scale(1) rotate(${rotation / 2}deg)`,
						`${origin}translate(${dx}px,${dy + config.gravityPx}px) scale(.9) rotate(${rotation}deg)`,
					],
					opacity: [1, 1, 0],
				}
			: {
					transform: [
						`${origin}translate(0,0) scale(.3) rotate(${type === 'line' ? rotation : 0}deg)`,
						`${origin}translate(${dx}px,${dy}px) scale(1) rotate(${rotation}deg)`,
					],
					opacity: [1, 0],
				}
		const times = config.gravityPx ? [0, 0.45, 1] : [0, 1]

		void animate(particle, keyframes, { duration, ease: EASE.out, times }).then(() => {
			particle.remove()
		})
	}
}

/** Centre of `element` in `host` coordinates — the usual burst origin. */
export const getCenterIn = (host: Element, element: Element): [number, number] => {
	const hostRect = host.getBoundingClientRect()
	const rect = element.getBoundingClientRect()
	return [rect.left - hostRect.left + rect.width / 2, rect.top - hostRect.top + rect.height / 2]
}
