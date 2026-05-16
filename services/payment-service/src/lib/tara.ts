export interface TaraPaymentResult {
  taraReference: string;
  status: "pending" | "successful" | "failed";
}

export async function initiateTaraPayment(opts: {
  amount: number;
  currency: string;
  mobileNumber: string;
  reference: string;
  description: string;
}): Promise<TaraPaymentResult> {
  // Mock: generate a reference, simulate STK push sent
  const taraReference = `TARA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  // In real implementation: POST to Tara API
  void opts; // suppress unused warning until real implementation
  return { taraReference, status: "pending" };
}

export async function getTaraPaymentStatus(taraReference: string): Promise<TaraPaymentResult["status"]> {
  // Mock: always return 'successful' after first poll (for V1 demo)
  void taraReference;
  return "successful";
}

export async function initiateTaraReversal(opts: {
  taraReference: string;
  amount: number;
  reason: string;
}): Promise<{ reversalId: string }> {
  void opts;
  return { reversalId: `TREV-${Date.now()}` };
}
