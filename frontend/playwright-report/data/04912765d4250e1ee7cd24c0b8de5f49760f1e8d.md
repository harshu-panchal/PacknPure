# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inventory.spec.js >> End-to-End Stock Reservation Architecture >> Admin Login and Verify Hub Inventory
- Location: tests\e2e\inventory.spec.js:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByPlaceholder(/password/i)

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e6]:
    - generic [ref=e8]:
      - generic [ref=e9]:
        - img [ref=e11]
        - generic [ref=e14]: Security Gateway
      - generic [ref=e15]:
        - heading "Admin Access" [level=1] [ref=e16]
        - paragraph [ref=e17]: Authorize to manage pack n pure ecosystem.
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]:
            - img [ref=e21]
            - textbox "Master Email Address" [active] [ref=e24]: Grhapoch@gmail.com
          - generic [ref=e25]:
            - button "Forgot PIN?" [ref=e27]
            - generic [ref=e28]:
              - img [ref=e29]
              - textbox "6-Digit Access PIN" [ref=e33]
        - button "ENTER TERMINAL" [ref=e34]:
          - generic [ref=e35]: ENTER TERMINAL
          - img [ref=e36]
    - generic [ref=e38]:
      - generic [ref=e40]: "HQ CORE: ACTIVE"
      - img "Logo" [ref=e43]
      - generic [ref=e44]:
        - img [ref=e49]
        - generic [ref=e58]:
          - generic [ref=e59]:
            - img [ref=e60]
            - text: "System Health: 100%"
          - heading "Master Command Center" [level=3] [ref=e62]
          - paragraph [ref=e63]: Oversee entire supply chain, manage users, and monitor financial health from a single secure node.
      - generic [ref=e64]:
        - generic [ref=e65]:
          - img [ref=e66]
          - generic [ref=e69]: Global Ops Node
        - generic [ref=e71]: v4.2.0-secure
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('End-to-End Stock Reservation Architecture', () => {
  4  |   test('Admin Login and Verify Hub Inventory', async ({ page }) => {
  5  |     // Navigate to admin login
  6  |     await page.goto('/admin');
  7  |     
  8  |     // Fill credentials (using the ones from .env)
  9  |     await page.getByPlaceholder(/email/i).fill('Grhapoch@gmail.com');
> 10 |     await page.getByPlaceholder(/password/i).fill('grhapoch123');
     |                                              ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  11 |     await page.getByRole('button', { name: /login|sign in/i }).click();
  12 | 
  13 |     // Verify successful login by waiting for Dashboard or Sidebar
  14 |     await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 10000 });
  15 | 
  16 |     // Navigate to Hub Inventory (or Stock)
  17 |     await page.getByRole('link', { name: /inventory/i }).click();
  18 |     
  19 |     // Wait for inventory table to load
  20 |     await expect(page.getByText(/available/i).first()).toBeVisible({ timeout: 10000 });
  21 |   });
  22 | });
  23 | 
```