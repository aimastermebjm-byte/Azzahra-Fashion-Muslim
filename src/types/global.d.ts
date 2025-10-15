import { Product } from './index';

declare global {
  interface Window {
    ProductStorage: typeof import('../utils/productStorage').ProductStorage;
    AppStorage: typeof import('../utils/appStorage').AppStorage;
  }
}

export {};