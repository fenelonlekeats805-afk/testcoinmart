import { BadRequestException } from '@nestjs/common';

const transitions: Record<string, Set<string>> = {
  PENDING_PAYMENT: new Set(['PAYMENT_DETECTED', 'EXPIRED']),
  PAYMENT_DETECTED: new Set(['PAYMENT_CONFIRMED', 'EXPIRED', 'EXTRA_PAYMENT']),
  PAYMENT_CONFIRMED: new Set(['DISPATCH_ENQUEUED', 'EXTRA_PAYMENT']),
  DISPATCH_ENQUEUED: new Set(['DISPATCH_SENT', 'FULFILL_FAILED_MANUAL']),
  DISPATCH_SENT: new Set(['FULFILLED', 'FULFILL_FAILED_MANUAL']),
  FULFILLED: new Set([]),
  FULFILL_FAILED_MANUAL: new Set([]),
  EXPIRED: new Set(['EXTRA_PAYMENT']),
  EXTRA_PAYMENT: new Set([]),
};

export function assertTransition(current: string, next: string): void {
  if (!transitions[current]?.has(next)) {
    throw new BadRequestException(`Invalid state transition ${current} -> ${next}`);
  }
}
