import { useQuery } from '@tanstack/react-query'

import { getHealth } from '../api/get-health'

export const healthQueryKey = ['health'] as const

export const useHealth = () =>
	useQuery({
		queryKey: healthQueryKey,
		queryFn: getHealth,
	})
