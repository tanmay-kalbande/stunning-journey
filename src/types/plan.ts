// src/types/plan.ts
// Plan types and limits for Pustakam - Only Monthly and Yearly plans

export type PlanType = 'monthly' | 'yearly';

export interface PlanLimits {
    maxBooks: number; // -1 for unlimited
    name: string;
    description: string;
}

export const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
    monthly: {
        maxBooks: -1, // unlimited
        name: 'Monthly PRO',
        description: 'Unlimited book generation',
    },
    yearly: {
        maxBooks: -1, // unlimited
        name: 'Yearly PRO',
        description: 'Unlimited book generation + best value',
    },
};

// Duration in days for each plan
export const PLAN_DURATION_DAYS: Record<PlanType, number> = {
    monthly: 30,
    yearly: 365,
};

// Pricing in INR (for display only)
export const PLAN_PRICING: Record<PlanType, number> = {
    monthly: 149,
    yearly: 1299,
};

export interface UserPlan {
    plan: PlanType;
    planExpiresAt: Date | null;
    booksCreated: number;
    isActive: boolean;
}

// Check if a plan is active (not expired)
export function isPlanActive(plan: PlanType, expiresAt: string | null): boolean {
    if (!expiresAt) return true; // No expiry means always active
    return new Date(expiresAt) > new Date();
}

// Get remaining books (always unlimited for paid plans)
export function getBooksRemaining(plan: PlanType, booksCreated: number): number {
    return Infinity; // Unlimited for all plans
}

// Check if user can create a book (always true for paid plans)
export function canCreateBook(plan: PlanType, booksCreated: number, expiresAt: string | null): boolean {
    return isPlanActive(plan, expiresAt);
}
