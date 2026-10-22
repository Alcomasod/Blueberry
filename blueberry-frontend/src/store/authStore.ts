// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
    id: number;
    role: string;
    full_name: string;
    login: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            login: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),
        }),
        {
            name: 'blueberry-auth', // Ключ в localStorage
        }
    )
);