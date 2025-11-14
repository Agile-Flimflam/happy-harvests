import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load login page and display correct title', async ({ page }) => {
    await page.goto('/login');
    
    // Verify page title contains "Happy Harvests"
    await expect(page).toHaveTitle(/Happy Harvests/);
  });

  test('should display login form elements', async ({ page }) => {
    await page.goto('/login');
    
    // Verify login form elements are visible
    await expect(page.getByRole('heading', { name: /Happy Harvests Login/i })).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('should redirect unauthenticated users from root to login', async ({ page }) => {
    // Navigate to root path
    await page.goto('/');
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
    
    // Verify we're on the login page
    await expect(page.getByRole('heading', { name: /Happy Harvests Login/i })).toBeVisible();
  });

  test('should have accessible form inputs with proper labels', async ({ page }) => {
    await page.goto('/login');
    
    // Check email input
    const emailInput = page.getByLabel(/Email Address/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('id', 'email');
    
    // Check password input
    const passwordInput = page.getByLabel(/Password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('id', 'password');
  });
});

