import { env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface CardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  valueCents: number;
  description: string;
  method: "card" | "pix";
  card?: CardInput;
  externalReference: string;
}

export interface CreateChargeInput {
  customerId: string;
  valueCents: number;
  description: string;
  method: "card" | "pix";
  card?: CardInput;
  externalReference: string;
}

export interface PixQr {
  encodedImage: string;
  payload: string;
}

export interface BillingProvider {
  createCustomer(input: {
    name: string;
    email: string;
    cpfCnpj: string;
    externalReference: string;
  }): Promise<{ id: string }>;
  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ id: string; firstPaymentId: string | null }>;
  createOneOffCharge(input: CreateChargeInput): Promise<{ id: string }>;
  updateSubscriptionValue(subscriptionId: string, valueCents: number): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getPaymentPixQr(paymentId: string): Promise<PixQr | null>;
}

function toReais(valueCents: number): number {
  return Math.round(valueCents) / 100;
}

function billingType(method: "card" | "pix"): string {
  return method === "card" ? "CREDIT_CARD" : "PIX";
}

class AsaasProvider implements BillingProvider {
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return logger.vendorCall("asaas", `${method} ${path}`, async () => {
      const response = await fetch(`${env().ASAAS_API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: env().ASAAS_API_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Asaas ${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
      }
      return (await response.json()) as T;
    });
  }

  async createCustomer(input: {
    name: string;
    email: string;
    cpfCnpj: string;
    externalReference: string;
  }) {
    const customer = await this.request<{ id: string }>("POST", "/customers", {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      externalReference: input.externalReference,
    });
    return { id: customer.id };
  }

  async createSubscription(input: CreateSubscriptionInput) {
    const nextDueDate = new Date().toISOString().slice(0, 10);
    const subscription = await this.request<{ id: string }>("POST", "/subscriptions", {
      customer: input.customerId,
      billingType: billingType(input.method),
      value: toReais(input.valueCents),
      nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
      ...(input.card
        ? {
            creditCard: {
              holderName: input.card.holderName,
              number: input.card.number,
              expiryMonth: input.card.expiryMonth,
              expiryYear: input.card.expiryYear,
              ccv: input.card.ccv,
            },
          }
        : {}),
    });
    const payments = await this.request<{ data: { id: string }[] }>(
      "GET",
      `/subscriptions/${subscription.id}/payments`,
    );
    return { id: subscription.id, firstPaymentId: payments.data[0]?.id ?? null };
  }

  async createOneOffCharge(input: CreateChargeInput) {
    const charge = await this.request<{ id: string }>("POST", "/payments", {
      customer: input.customerId,
      billingType: billingType(input.method),
      value: toReais(input.valueCents),
      dueDate: new Date().toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
    });
    return { id: charge.id };
  }

  async updateSubscriptionValue(subscriptionId: string, valueCents: number) {
    await this.request("PUT", `/subscriptions/${subscriptionId}`, {
      value: toReais(valueCents),
      updatePendingPayments: true,
    });
  }

  async cancelSubscription(subscriptionId: string) {
    await this.request("DELETE", `/subscriptions/${subscriptionId}`);
  }

  async getPaymentPixQr(paymentId: string) {
    try {
      return await this.request<PixQr>("GET", `/payments/${paymentId}/pixQrCode`);
    } catch {
      return null;
    }
  }
}

// Fake em memória — os testes disparam os webhooks diretamente (quickstart).
let fakeCounter = 0;

class FakeBillingProvider implements BillingProvider {
  async createCustomer() {
    return { id: `fake_cus_${++fakeCounter}` };
  }

  async createSubscription() {
    const id = ++fakeCounter;
    return { id: `fake_sub_${id}`, firstPaymentId: `fake_pay_${id}` };
  }

  async createOneOffCharge() {
    return { id: `fake_pay_${++fakeCounter}` };
  }

  async updateSubscriptionValue() {}

  async cancelSubscription() {}

  async getPaymentPixQr(): Promise<PixQr> {
    return { encodedImage: "fake-qr-base64", payload: "fake-pix-copia-e-cola" };
  }
}

let cached: BillingProvider | null = null;

export function billingProvider(): BillingProvider {
  if (!cached) {
    cached = fakeVendorsEnabled() ? new FakeBillingProvider() : new AsaasProvider();
  }
  return cached;
}
