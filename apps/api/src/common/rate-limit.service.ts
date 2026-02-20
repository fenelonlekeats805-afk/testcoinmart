import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async assertIpOrderLimit(ip: string): Promise<void> {
    const limit = Number(process.env.IP_RATE_LIMIT_PER_MINUTE || 1);
    const minuteKey = new Date().toISOString().slice(0, 16);
    const key = `ip_limit:orders:${ip}:${minuteKey}`;
    const value = await this.redis.client.incr(key);
    if (value === 1) {
      await this.redis.client.expire(key, 70);
    }
    if (value > limit) {
      throw new HttpException('Too many order creation requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
