# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-order-flow.spec.js >> E2E Scenarios: Inventory Flow >> Scenario 1: Admin Login and Verify Hub Inventory
- Location: tests\e2e\01-order-flow.spec.js:5:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/dashboard/i).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText(/dashboard/i).first()

```

```yaml
- text: Security Gateway
- heading "Admin Access" [level=1]
- paragraph: Authorize to manage pack n pure ecosystem.
- textbox "Master Email Address": Grhapoch@gmail.com
- button "Forgot PIN?"
- textbox "6-Digit Access PIN": grhapo
- button "ENTER TERMINAL"
- text: "HQ CORE: ACTIVE"
- img "Logo"
- img
- text: "System Health: 100%"
- heading "Master Command Center" [level=3]
- paragraph: Oversee entire supply chain, manage users, and monitor financial health from a single secure node.
- text: Global Ops Node v4.2.0-secure
- region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect } from '@playwright/test';
  2  | 
  3  | export async function loginAsAdmin(page) {
  4  |   await page.goto('/admin');
  5  |   await page.getByPlaceholder(/email/i).fill('Grhapoch@gmail.com');
  6  |   await page.getByPlaceholder(/pin/i).fill('grhapoch123');
  7  |   await page.getByRole('button', { name: /enter terminal/i }).click();
> 8  |   await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 15000 });
     |                                                      ^ Error: expect(locator).toBeVisible() failed
  9  | }
  10 | 
  11 | export async function loginAsSeller(page) {
  12 |   await page.goto('/seller');
  13 |   // Wait, I need to know seller credentials. The seed script creates seller:
  14 |   // phone: "9876543210", password: "password123"
  15 |   await page.getByPlaceholder(/phone|email/i).fill('9876543210');
  16 |   await page.getByPlaceholder(/password/i).fill('password123');
  17 |   await page.getByRole('button', { name: /login|sign in/i }).click();
  18 |   await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 15000 });
  19 | }
  20 | 
  21 | export async function loginAsCustomer(page) {
  22 |   await page.goto('/');
  23 |   await page.getByRole('button', { name: /login|sign/i }).first().click();
  24 |   
  25 |   // Fill phone number
  26 |   await page.getByPlaceholder(/phone/i).fill('9999999999');
  27 |   await page.getByRole('button', { name: /get otp/i }).click();
  28 |   
  29 |   // Fill OTP
  30 |   await page.getByPlaceholder(/otp/i).first().fill('110211'); // Mock OTP
  31 |   await page.getByRole('button', { name: /verify/i }).click();
  32 |   
  33 |   // Wait for profile or home indication
  34 |   await expect(page.locator('text=Profile').first()).toBeVisible({ timeout: 15000 });
  35 | }
  36 | 
```