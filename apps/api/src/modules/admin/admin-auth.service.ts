import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

interface AdminJwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AdminAuthService {
  private getSecret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Missing ADMIN_JWT_SECRET');
    }
    return secret;
  }

  sign(payload: AdminJwtPayload): string {
    return jwt.sign(payload, this.getSecret(), { expiresIn: '8h' });
  }

  verify(token: string): AdminJwtPayload {
    try {
      return jwt.verify(token, this.getSecret()) as AdminJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }
  }
}
