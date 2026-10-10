import { useLocation } from 'react-router'

/** Tests only: reports the router pathname on every render. */
export const PathnameSpy = ({ onPathname }: { onPathname: (pathname: string) => void }): null => {
	onPathname(useLocation().pathname)
	return null
}
