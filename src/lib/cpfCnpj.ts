export function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

function isAllSameDigit(digits: string): boolean {
  return digits.split("").every((digit) => digit === digits[0]);
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || isAllSameDigit(digits)) {
    return false;
  }
  const firstCheck = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondCheck = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstCheck === Number(digits[9]) && secondCheck === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || isAllSameDigit(digits)) {
    return false;
  }
  const firstCheck = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondCheck = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstCheck === Number(digits[12]) && secondCheck === Number(digits[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const digits = sanitizeCpfCnpj(value);
  return isValidCpf(digits) || isValidCnpj(digits);
}
