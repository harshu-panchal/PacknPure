import { test, expect } from '@playwright/test';

test.describe('End-to-End Stock Reservation Architecture', () => {
  test('Admin Login and Verify Hub Inventory', async ({ page }) => {
    // Navigate to admin login
    await page.goto('/admin');
    
    // Fill credentials (using the ones from .env)
    await page.getByPlaceholder(/email/i).fill('Grhapoch@gmail.com');
    await page.getByPlaceholder(/password/i).fill('grhapoch123');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Verify successful login by waiting for Dashboard or Sidebar
    await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 10000 });

    // Navigate to Hub Inventory (or Stock)
    await page.getByRole('link', { name: /inventory/i }).click();
    
    // Wait for inventory table to load
    await expect(page.getByText(/available/i).first()).toBeVisible({ timeout: 10000 });
  });
});
