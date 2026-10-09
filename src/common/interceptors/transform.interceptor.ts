import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResult,
} from '../interfaces/api-response.interface';

/**
 * Wraps every successful response in a consistent envelope:
 *
 *   { "success": true, "data": <payload>, "timestamp": "<iso>" }
 *
 * Paginated services return `{ data, meta }`. Those are preserved so the client
 * receives `{ success, data, meta, timestamp }`.
 *
 * Empty 204 responses are left untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((payload) => {
        const response = context.switchToHttp().getResponse<Response>();

        if (response.statusCode === 204 || payload === undefined) {
          return payload;
        }

        const timestamp = new Date().toISOString();

        if (this.isPaginated(payload)) {
          return {
            success: true,
            data: payload.data as T,
            meta: payload.meta,
            timestamp,
          };
        }

        return { success: true, data: payload, timestamp };
      }),
    );
  }

  private isPaginated(value: unknown): value is PaginatedResult<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value &&
      Array.isArray((value as PaginatedResult<T>).data)
    );
  }
}
