import { env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface CardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

// Dados do titular exigidos pelo Asaas em toda cobrança de cartão com dados
// crus (creditCardHolderInfo). Precisam bater com o cadastro do emissor, senão
// a transação é negada por suspeita de fraude.
export interface CardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  valueCents: number;
  description: string;
  method: "card" | "pix";
  card?: CardInput;
  holderInfo?: CardHolderInfo;
  remoteIp?: string;
  externalReference: string;
}

export interface CreateChargeInput {
  customerId: string;
  valueCents: number;
  description: string;
  method: "card" | "pix";
  card?: CardInput;
  holderInfo?: CardHolderInfo;
  remoteIp?: string;
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
  // Desativa/reativa sem apagar (soft-cancel reversível). Reativar exige a
  // próxima data de cobrança (nextDueDate) — regra do Asaas.
  deactivateSubscription(subscriptionId: string): Promise<void>;
  reactivateSubscription(subscriptionId: string, nextDueDate: Date): Promise<void>;
  getPaymentPixQr(paymentId: string): Promise<PixQr | null>;
  // Status real da cobrança no Asaas (PENDING, RECEIVED, CONFIRMED, OVERDUE,
  // DELETED, ...). Retorna null quando a cobrança não pôde ser consultada.
  getPaymentStatus(paymentId: string): Promise<string | null>;
}

function toReais(valueCents: number): number {
  return Math.round(valueCents) / 100;
}

function billingType(method: "card" | "pix"): string {
  return method === "card" ? "CREDIT_CARD" : "PIX";
}

// Bloco de cartão que o Asaas exige para captura direta: o cartão em si, os
// dados do titular (creditCardHolderInfo) e o IP do comprador (remoteIp). Vazio
// quando não há cartão (Pix), para não enviar campos indevidos.
function creditCardPayload(input: {
  card?: CardInput;
  holderInfo?: CardHolderInfo;
  remoteIp?: string;
}): Record<string, unknown> {
  if (!input.card) {
    return {};
  }
  return {
    creditCard: {
      holderName: input.card.holderName,
      number: input.card.number,
      expiryMonth: input.card.expiryMonth,
      expiryYear: input.card.expiryYear,
      ccv: input.card.ccv,
    },
    ...(input.holderInfo ? { creditCardHolderInfo: input.holderInfo } : {}),
    ...(input.remoteIp ? { remoteIp: input.remoteIp } : {}),
  };
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
      ...creditCardPayload(input),
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
      ...creditCardPayload(input),
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

  async deactivateSubscription(subscriptionId: string) {
    await this.request("PUT", `/subscriptions/${subscriptionId}`, { status: "INACTIVE" });
  }

  async reactivateSubscription(subscriptionId: string, nextDueDate: Date) {
    await this.request("PUT", `/subscriptions/${subscriptionId}`, {
      status: "ACTIVE",
      nextDueDate: nextDueDate.toISOString().slice(0, 10),
    });
  }

  async getPaymentPixQr(paymentId: string) {
    try {
      return await this.request<PixQr>("GET", `/payments/${paymentId}/pixQrCode`);
    } catch {
      return null;
    }
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const payment = await this.request<{ status: string }>("GET", `/payments/${paymentId}`);
      return payment.status ?? null;
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

  async deactivateSubscription() {}

  async reactivateSubscription() {}

  async getPaymentPixQr(): Promise<PixQr> {
    return { encodedImage: "fake-qr-base64", payload: "fake-pix-copia-e-cola" };
  }

  async getPaymentStatus(): Promise<string> {
    return "PENDING";
  }
}

let cached: BillingProvider | null = null;

export function billingProvider(): BillingProvider {
  if (!cached) {
    cached = fakeVendorsEnabled() ? new FakeBillingProvider() : new AsaasProvider();
  }
  return cached;
}
