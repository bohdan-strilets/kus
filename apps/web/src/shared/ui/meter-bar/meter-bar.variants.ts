import { cva } from 'class-variance-authority'

/** 2 px inset on all four sides: the fill radius is the track radius minus it, so both stay round. */
export const meterTrackVariants = cva('flex h-3 rounded-full bg-track p-0.5')

/** min-w-2 = the fill height, so a tiny share is still a visible circle. */
export const meterFillVariants = cva('block h-full rounded-full')

export const METER_MIN_FILL_CLASS = 'min-w-2'
