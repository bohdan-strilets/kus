import { animate } from 'motion'

import type { BurstConfig } from './celebrate'
import { isReducedMotion } from './motion.imperative'
import { createParticle } from './particle'
import { EASE } from './transition'

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

const getAngle = (config: BurstConfig, index: number): number => {
	if (config.spread) return randomBetween(config.spread[0], config.spread[1])
	return (index / config.count) * Math.PI * 2 + Math.random() * 0.4
}

/**
 * Particles fly out of the centre of `origin` inside `host` (host: position relative,
 * overflow visible). Skipped entirely under reduced motion.
 */
export const burst = (host: HTMLElement, origin: Element, config: BurstConfig): void => {
	if (isReducedMotion()) return
	const hostRect = host.getBoundingClientRect()
	const rect = origin.getBoundingClientRect()
	const x = rect.left - hostRect.left + rect.width / 2
	const y = rect.top - hostRect.top + rect.height / 2

	for (let index = 0; index < config.count; index++) {
		const type = config.types[index % config.types.length] ?? 'dot'
		const color = config.colors[index % config.colors.length] ?? ''
		const particle = createParticle(type, color)
		host.appendChild(particle)

		const angle = getAngle(config, index)
		const distance = config.distance * randomBetween(0.65, 1.15)
		const dx = Math.cos(angle) * distance
		const dy = Math.sin(angle) * distance
		const rotation = type === 'line' ? (angle * 180) / Math.PI : randomBetween(-120, 120)
		const base = `translate(${x}px,${y}px) translate(-50%,-50%) `
		const duration = (config.durationMs * randomBetween(0.8, 1.2)) / 1000

		const keyframes = config.gravity
			? {
					transform: [
						`${base}translate(0,0) scale(.3) rotate(0deg)`,
						`${base}translate(${dx * 0.8}px,${dy - 20}px) scale(1) rotate(${rotation / 2}deg)`,
						`${base}translate(${dx}px,${dy + config.gravity}px) scale(.9) rotate(${rotation}deg)`,
					],
					opacity: [1, 1, 0],
				}
			: {
					transform: [
						`${base}translate(0,0) scale(.3) rotate(${type === 'line' ? rotation : 0}deg)`,
						`${base}translate(${dx}px,${dy}px) scale(1) rotate(${rotation}deg)`,
					],
					opacity: [1, 0],
				}
		const times = config.gravity ? [0, 0.45, 1] : undefined

		void animate(particle, keyframes, { duration, ease: EASE.out, times }).then(() => {
			particle.remove()
		})
	}
}
