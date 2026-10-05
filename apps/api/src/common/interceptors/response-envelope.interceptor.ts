import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'

export interface DataEnvelope<T> {
	data: T
}

/** Wraps every successful response in `{ data }` (CLAUDE.md §5). */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, DataEnvelope<T>> {
	intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<DataEnvelope<T>> {
		return next.handle().pipe(map((data) => ({ data })))
	}
}
