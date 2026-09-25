import { useEffect, useState } from "react";
import type { PerfilPasajes } from "../types/pasajes.types";
import { record } from "../utils/api.utils";

export function localProfile(): PerfilPasajes | null {
  try {
    const u = record(
      JSON.parse(localStorage.getItem("user") ?? "{}") as unknown,
    );
    let jwt: Record<string, unknown> = {};
    const t = localStorage.getItem("token")?.split(".")[1];
    if (t) {
      const b = t.replace(/-/g, "+").replace(/_/g, "/");
      jwt = record(
        JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(
              atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")),
              (c) => c.charCodeAt(0),
            ),
          ),
        ) as unknown,
      );
    }
    const role =
      jwt.role ??
      jwt["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
      u.rol;
    const raw = jwt.oficinaId ?? u.oficinaId;
    const office = Number(raw);

    return typeof role === "string"
      ? {
          rol: role,
          oficinaId:
            raw != null && Number.isInteger(office) && office > 0
              ? office
              : null,
        }
      : null;
  } catch {
    return null;
  }
}

export function useProfile(explicit?: PerfilPasajes) {
  const [profile, setProfile] = useState(localProfile);

  useEffect(() => {
    const update = () => setProfile(localProfile());
    window.addEventListener("storage", update);
    window.addEventListener("jjr:session-changed", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("jjr:session-changed", update);
    };
  }, []);

  return explicit ?? profile;
}