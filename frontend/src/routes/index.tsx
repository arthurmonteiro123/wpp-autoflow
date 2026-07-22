import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("wpp_auth_user");
    if (!raw) throw redirect({ to: "/login" });
    try {
      const u = JSON.parse(raw) as { role: string };
      if (u.role === "VENDEDOR") throw redirect({ to: "/painel" });
      throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as any)) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: () => null,
});
