/**
 * Unique Payment Code Generator
 * Generates 2-digit unique codes for payment verification
 */

/**
 * Generate a random 2-digit unique code (10-99)
 * This code will be added to the payment amount for unique identification
 */
export function generateUniquePaymentCode(): number {
  // Generate random number between 10-99 (2 digits)
  const min = 10;
  const max = 99;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return code;
}

/**
 * Generate unique code based on timestamp
 * More predictable but still unique per second
 */
export function generateTimeBasedCode(): number {
  const now = Date.now();
  const code = now % 90 + 10; // Last 2 digits, ensure 10-99 range
  return code;
}

/**
 * Calculate exact payment amount with unique code
 */
export function calculateExactAmount(originalAmount: number, uniqueCode: number): number {
  return originalAmount + uniqueCode;
}

/**
 * Extract unique code from exact amount
 */
export function extractUniqueCode(exactAmount: number, originalAmount: number): number {
  return exactAmount - originalAmount;
}

/**
 * Format amount for display with highlighted unique code
 */
export function formatAmountWithCode(originalAmount: number, uniqueCode: number): {
  total: string;
  baseAmount: string;
  code: string;
} {
  const exactAmount = calculateExactAmount(originalAmount, uniqueCode);
  const formatted = exactAmount.toLocaleString('id-ID');
  
  // Split to highlight last 2 digits
  const amountStr = exactAmount.toString();
  const baseLength = amountStr.length - 2;
  const baseAmount = amountStr.substring(0, baseLength);
  const code = amountStr.substring(baseLength);
  
  return {
    total: formatted,
    baseAmount: baseAmount,
    code: code
  };
}

/**
 * Validate if an amount matches with unique code
 */
export function validateExactAmount(
  detectedAmount: number,
  originalAmount: number,
  uniqueCode: number
): boolean {
  const expectedAmount = calculateExactAmount(originalAmount, uniqueCode);
  return detectedAmount === expectedAmount;
}
