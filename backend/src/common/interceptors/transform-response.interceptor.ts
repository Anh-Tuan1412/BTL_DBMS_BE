import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((result) => {
        // If the service/controller already returns formatted response
        if (
          result &&
          typeof result === 'object' &&
          'data' in result &&
          'message' in result
        ) {
          return {
            statusCode,
            success: true,
            message: result.message || 'Thành công',
            data: result.data,
          };
        }

        return {
          statusCode,
          success: true,
          message: 'Thao tác thành công',
          data: result,
        };
      }),
    );
  }
}
