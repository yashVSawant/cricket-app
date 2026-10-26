import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: unknown;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((resData) => {
        // If data is already wrapped or null
        if (resData && typeof resData === 'object' && 'items' in resData && 'meta' in resData) {
          return {
            success: true,
            statusCode,
            data: resData.items,
            meta: resData.meta,
          };
        }

        return {
          success: true,
          statusCode,
          data: resData,
        };
      }),
    );
  }
}
