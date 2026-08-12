import { describe, it, expect } from 'vitest';
import routes from '../src/router/routes';

describe('Frontend Router & Auth Guard Configuration Tests', () => {
  it('should contain all essential route definitions', () => {
    const routeNames = routes.map((r) => r.name);
    expect(routeNames).toContain('Login');
    expect(routeNames).toContain('Register');
    expect(routeNames).toContain('Dashboard');
    expect(routeNames).toContain('Boards');
    expect(routeNames).toContain('BoardDetails');
  });

  it('should mark protected routes with requiresAuth: true', () => {
    const dashboardRoute = routes.find((r) => r.name === 'Dashboard');
    const boardsRoute = routes.find((r) => r.name === 'Boards');

    expect(dashboardRoute?.meta?.requiresAuth).toBe(true);
    expect(boardsRoute?.meta?.requiresAuth).toBe(true);
  });

  it('should mark login and register routes as guestOnly: true', () => {
    const loginRoute = routes.find((r) => r.name === 'Login');
    const registerRoute = routes.find((r) => r.name === 'Register');

    expect(loginRoute?.meta?.requiresAuth).toBe(false);
    expect(loginRoute?.meta?.guestOnly).toBe(true);
    expect(registerRoute?.meta?.guestOnly).toBe(true);
  });

  it('should redirect root path "/" to "/dashboard"', () => {
    const rootRoute = routes.find((r) => r.path === '/');
    expect(rootRoute?.redirect).toBe('/dashboard');
  });
});
