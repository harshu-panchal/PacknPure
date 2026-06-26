import { customerApi } from './customerApi';

/**
 * Home page API layer — called only from useHomePage (not from UI components).
 */
export const homeService = {
  /** @param {Record<string, unknown>} [params] e.g. `{ roots: true }` */
  getCategories: (params) => customerApi.getCategories(params),

  getProducts: (params) => customerApi.getProducts(params),

  getExperienceSections: (params) =>
    customerApi.getExperienceSections(params).catch(() => null),

  getHeroConfig: (params) =>
    customerApi.getHeroConfig(params).catch(() => null),
};
