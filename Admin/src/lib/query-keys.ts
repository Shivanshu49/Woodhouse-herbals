/**
 * Central react-query key factory. Every query/mutation references a key
 * from here so invalidations stay consistent across the app.
 */
export const qk = {
  me: ['auth', 'me'] as const,
  dashboardStats: ['dashboard', 'stats'] as const,
};
