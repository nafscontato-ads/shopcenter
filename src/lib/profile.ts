import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
};

async function signedAvatar(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error("Você precisa estar logado.");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, status, created_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const profile = (data ?? null) as Profile | null;
      return { profile, avatarUrl: await signedAvatar(profile?.avatar_url ?? null) };
    },
  });

  return {
    profile: query.data?.profile ?? null,
    avatarUrl: query.data?.avatarUrl ?? null,
    isLoading: query.isLoading,
  };
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { fullName?: string; avatarFile?: File | null }) => {
      if (!user) throw new Error("Você precisa estar logado.");
      const patch: { full_name?: string; avatar_url?: string } = {};

      if (input.fullName !== undefined) patch.full_name = input.fullName.trim();

      if (input.avatarFile) {
        const ext = input.avatarFile.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, input.avatarFile, { upsert: true, contentType: input.avatarFile.type });
        if (error) throw new Error(error.message);
        patch.avatar_url = path;
      }

      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]!.toUpperCase();
}
