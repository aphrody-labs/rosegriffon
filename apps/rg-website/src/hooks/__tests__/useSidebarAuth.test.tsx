import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/client";

import { useSidebarAuth } from "../useSidebarAuth";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("useSidebarAuth", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockGetUser = vi.fn();
  const mockOnAuthStateChange = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });

    // Setup default mock implementation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient as any).mockReturnValue({
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
      from: mockFrom,
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("should return initial loading state", () => {
    mockGetUser.mockReturnValue(new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useSidebarAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
  });

  it("should handle unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    });

    const { result } = renderHook(() => useSidebarAuth(), { wrapper });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000 }
    );

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should handle authenticated user with profile", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockProfile = { id: "user-123", username: "testuser" };

    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    });

    const { result } = renderHook(() => useSidebarAuth(), { wrapper });

    await waitFor(
      () => {
        expect(result.current.user).toEqual(mockUser);
      },
      { timeout: 2000 }
    );

    await waitFor(
      () => {
        expect(result.current.profile).toEqual(mockProfile);
      },
      { timeout: 2000 }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle error fetching user", async () => {
    mockGetUser.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSidebarAuth(), { wrapper });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000 }
    );

    expect(result.current.error).toBe("Network error");
  });
});
