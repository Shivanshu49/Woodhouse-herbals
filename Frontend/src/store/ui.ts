'use client';

import { create } from 'zustand';

interface UiState {
  searchOpen: boolean;
  mobileNavOpen: boolean;
  cartDrawerOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setCartDrawerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  searchOpen: false,
  mobileNavOpen: false,
  cartDrawerOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
}));
