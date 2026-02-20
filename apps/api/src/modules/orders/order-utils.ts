import { BadRequestException } from '@nestjs/common';
import { isValidSuiAddress } from '@mysten/sui/utils';

const evmRegex = /^0x[a-fA-F0-9]{40}$/;
const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const tonFriendlyRegex = /^(EQ|UQ)[A-Za-z0-9_-]{46}$/;
const suiHexRegex = /^0x[a-fA-F0-9]+$/;

export function validateFulfillmentAddress(kind: 'EVM' | 'SOLANA' | 'TON' | 'SUI_NATIVE', value: string): void {
  if (kind === 'EVM' && !evmRegex.test(value)) {
    throw new BadRequestException('Invalid EVM address format');
  }
  if (kind === 'SOLANA' && !solRegex.test(value)) {
    throw new BadRequestException('Invalid Solana address format');
  }
  if (kind === 'TON' && !tonFriendlyRegex.test(value)) {
    throw new BadRequestException('Invalid TON address format');
  }
  // Source: https://sdk.mystenlabs.com/typescript/utils (isValidSuiAddress), checked 2026-02-12.
  if (kind === 'SUI_NATIVE' && (!suiHexRegex.test(value) || !isValidSuiAddress(value))) {
    throw new BadRequestException('Invalid Sui address format. Expected 0x-prefixed hex Sui address');
  }
}

export function toRawAmount(display: string, decimals: number): string {
  const [wholeRaw, fractionRaw = ''] = display.split('.');
  const whole = wholeRaw || '0';
  const fraction = (fractionRaw + '0'.repeat(decimals)).slice(0, decimals);
  const normalized = `${whole}${fraction}`.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException('Invalid decimal amount');
  }
  return normalized;
}
