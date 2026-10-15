import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guests may view the map. When credentials are supplied they must be valid,
// so a signed-in customer can reliably identify their own holds.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.headers.authorization) return true;
    return super.canActivate(context);
  }
}
