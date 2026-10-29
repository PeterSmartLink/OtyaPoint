export interface SaleFingerprintLine {
  productId: string;
  quantity: number;
}
export function saleRequestFingerprint(
  paymentMethod: string,
  lines: SaleFingerprintLine[]
): Promise<string>;
