import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSeller, loginAsCustomer } from './helpers.js';

test.describe('E2E Scenarios: Inventory Flow', () => {
  test('Scenario 1: Admin Login and Verify Hub Inventory', async ({ page }) => {
    // Navigate to admin login
    await loginAsAdmin(page);
    
    // Navigate to Hub Inventory (or Stock)
    await page.getByRole('link', { name: /inventory/i }).click();
    
    // Wait for inventory table to load
    await expect(page.getByText(/available/i).first()).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    await page.screenshot({ path: 'scenario1_admin_inventory.png', fullPage: true });
  });

  test('Scenario 2: Customer Login and Add to Cart', async ({ page }) => {
    await loginAsCustomer(page);
    
    // Navigate to products
    await page.goto('/categories');
    
    // Find a product and add to cart
    // Since we seeded "Amul Taaza Toned Milk"
    await page.getByText(/amul taaza/i).first().click();
    
    await expect(page.getByText(/add to cart/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(/add to cart/i).first().click();
    
    await page.screenshot({ path: 'scenario2_add_to_cart.png' });
  });
});
