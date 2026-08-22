import { getCurrentMerchant } from "@/lib/merchant-auth";

export async function requireMerchant() {
  const merchant = await getCurrentMerchant();
  if (!merchant) return null;
  return merchant;
}

export function merchantWhere(merchantId: string) {
  return { merchantId };
}
