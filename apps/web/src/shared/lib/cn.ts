import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Joins conditional class names and resolves Tailwind conflicts (last one wins). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
