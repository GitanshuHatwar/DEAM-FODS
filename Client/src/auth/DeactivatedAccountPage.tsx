import { LogOut, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAuth } from "./AuthProvider";

export function DeactivatedAccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F6F3] px-4 py-12 flex items-center justify-center">
      <GlassPanel padding="lg" className="w-full max-w-md bg-white/90 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D99A45]/15 text-[#D99A45]">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#0F172A]">
          Account Deactivated
        </h1>
        <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">
          {user?.email ? (
            <>
              Access for <strong className="text-[#0F172A]">{user.email}</strong> has been suspended by an administrator.
            </>
          ) : (
            "Your account has been suspended by an administrator."
          )}{" "}
          Past maintenance tickets and repair history remain preserved. Please contact your lab or system administrator to restore access.
        </p>

        <Button
          variant="primary"
          className="mt-6 w-full"
          leftIcon={<LogOut className="h-4 w-4" />}
          onClick={handleLogout}
        >
          Sign Out
        </Button>
      </GlassPanel>
    </div>
  );
}
