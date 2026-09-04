'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, toApiError, type ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export interface TeamMemberView {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  isSelf: boolean;
  createdAt: string | null;
}

export interface TeamInvitationView {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}

export interface TeamResponse {
  mode: 'ok' | 'local';
  canManage: boolean;
  isOwner: boolean;
  self: { role: string; permissions: string[]; isOwner: boolean };
  members: TeamMemberView[];
  invitations: TeamInvitationView[];
}

export interface InvitePayload {
  email: string;
  role: string;
  expiresInDays: number;
  permissions?: string[];
}

export interface InviteResponse {
  invitation: {
    id: string;
    email: string;
    role: string;
    roleLabel: string;
    permissions: string[];
    expiresAt: string;
  };
  inviteUrl: string;
}

export function useTeam() {
  const query = useQuery({
    queryKey: queryKeys.team,
    staleTime: 30_000,
    queryFn: () => apiFetch<TeamResponse>('/api/team'),
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refetch: () => void query.refetch(),
  };
}

function useTeamInvalidation() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.team });
}

export function useInviteMember() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (payload: InvitePayload) =>
      apiFetch<InviteResponse>('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeInvitation() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/team/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useUpdateMember() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; permissions?: string[]; status?: string }) =>
      apiFetch<{ ok: boolean }>(`/api/team/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/team/members/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export type { ApiError };
