import { expect } from '@playwright/test';

export async function loginAsAdmin(page) {
  await page.goto('/admin');
  await page.getByPlaceholder(/email/i).fill('Grhapoch@gmail.com');
  await page.getByPlaceholder(/pin/i).fill('grhapoch123');
  await page.getByRole('button', { name: /enter terminal/i }).click();
  await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 15000 });
}

export async function loginAsSeller(page) {
  await page.goto('/seller');
  // Wait, I need to know seller credentials. The seed script creates seller:
  // phone: "9876543210", password: "password123"
  await page.getByPlaceholder(/phone|email/i).fill('9876543210');
  await page.getByPlaceholder(/password/i).fill('password123');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 15000 });
}

export async function loginAsCustomer(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /login|sign/i }).first().click();
  
  // Fill phone number
  await page.getByPlaceholder(/phone/i).fill('9999999999');
  await page.getByRole('button', { name: /get otp/i }).click();
  
  // Fill OTP
  await page.getByPlaceholder(/otp/i).first().fill('110211'); // Mock OTP
  await page.getByRole('button', { name: /verify/i }).click();
  
  // Wait for profile or home indication
  await expect(page.locator('text=Profile').first()).toBeVisible({ timeout: 15000 });
}
