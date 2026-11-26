import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Cpu,
  FileText,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Radio,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { RoleBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectionBadge } from "@/components/layout/ConnectionBadge";
import { LiveTapDrawer } from "@/features/tap/LiveTapDrawer";
import { MockTapSimulatorBar } from "@/features/tap/MockTapSimulatorBar";
import { useLiveTap } from "@/features/tap/useLiveTap";
import { isMockMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/auth";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

function getNavItems(role: Role): NavItem[] {
  if (role === "customer") {
    return [
      {
        to: "/portal",
        label: "My Tickets",
        icon: <ListChecks className="h-4 w-4" />,
        end: true,
      },
      {
        to: "/portal/new",
        label: "Report a Fault",
        icon: <PlusCircle className="h-4 w-4" />,
      },
    ];
  }

  const techItems: NavItem[] = [
    {
      to: "/tech",
      label: "Priority Queue",
      icon: <Layers className="h-4 w-4" />,
      end: true,
    },
    {
      to: "/tech/devices",
      label: "Equipment Registry",
      icon: <Cpu className="h-4 w-4" />,
    },
  ];

  if (role === "technician") {
    return techItems;
  }

  return [
    {
      to: "/admin",
      label: "Overview",
      icon: <Activity className="h-4 w-4" />,
      end: true,
    },
    ...techItems,
    {
      to: "/admin/devices",
      label: "Device Lifecycle",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      to: "/admin/users",
      label: "Users & Techs",
      icon: <Users className="h-4 w-4" />,
    },
    {
      to: "/admin/scanners",
      label: "RFID Scanners",
      icon: <Radio className="h-4 w-4" />,
    },
    {
      to: "/admin/audit-log",
      label: "Audit Log",
      icon: <FileText className="h-4 w-4" />,
    },
  ];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isTechOrAdmin = user?.role === "technician" || user?.role === "admin";
  const tapState = useLiveTap(Boolean(isTechOrAdmin));

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="space-y-1" aria-label="Primary navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onItemClick}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-[#E8F3EF] text-[#2E5D4B] font-semibold"
                : "text-[#6B7280] hover:bg-[#F8F6F3] hover:text-[#0F172A]",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#2E5D4B]" />
              )}
              <span
                className={cn(
                  "shrink-0 transition-colors",
                  isActive
                    ? "text-[#2E5D4B]"
                    : "text-[#6B7280] group-hover:text-[#0F172A]",
                )}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F8F6F3] text-[#0F172A]">
      {/* Translucent Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E5E7EB]/85 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-[#E5E7EB] bg-white p-2 text-[#0F172A] lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2E5D4B] text-white shadow-sm transition-transform group-hover:scale-[1.03]">
                <Radio className="h-4.5 w-4.5" />
              </div>
              <div className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-[#0F172A]">
                  DEAM-FODS
                </span>
                <span className="hidden text-[11px] text-[#6B7280] sm:block">
                  Smart Lab Maintenance &amp; RFID Ticketing
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {isTechOrAdmin && (
              <>
                <ConnectionBadge state={tapState.connectionStatus} />
                <Button
                  variant={tapState.latestTap ? "mint" : "secondary"}
                  size="sm"
                  leftIcon={<Radio className="h-3.5 w-3.5" />}
                  onClick={() => tapState.setDrawerOpen(true)}
                >
                  <span className="hidden sm:inline">Live Tap</span>
                  {tapState.latestTap && (
                    <span className="ml-1 rounded-md bg-[#2E5D4B] px-1.5 py-0.5 font-mono text-[10px] text-white">
                      {tapState.latestTap.rfid_uid}
                    </span>
                  )}
                </Button>
              </>
            )}

            <div className="hidden items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white/90 px-3 py-1.5 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold text-[#0F172A]">
                  {user.full_name}
                </p>
                <p className="text-[11px] text-[#6B7280]">{user.email}</p>
              </div>
              <RoleBadge role={user.role} />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Shell */}
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-22 space-y-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white/90 p-3 shadow-card backdrop-blur-sm">
              <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Workspace
              </p>
              {renderNavLinks()}
            </div>

            {isTechOrAdmin && isMockMode && (
              <MockTapSimulatorBar
                onTapSimulated={(payload) => tapState.pushSimulatedTap(payload)}
              />
            )}
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="min-w-0 flex-1 pb-12">
          {isTechOrAdmin && isMockMode && (
            <div className="mb-4 lg:hidden">
              <MockTapSimulatorBar
                compact
                onTapSimulated={(payload) => tapState.pushSimulatedTap(payload)}
              />
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-[#0F172A]/35 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex h-full w-72 flex-col justify-between bg-white p-4 shadow-2xl"
            >
              <div>
                <div className="mb-5 flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2E5D4B] text-white">
                      <Radio className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">DEAM-FODS</p>
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F8F6F3]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {renderNavLinks(() => setMobileMenuOpen(false))}
              </div>

              <div className="border-t border-[#E5E7EB] pt-4">
                <div className="mb-3 rounded-xl bg-[#F8F6F3] p-3">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {user.full_name}
                  </p>
                  <p className="text-[11px] text-[#6B7280] truncate">
                    {user.email}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  leftIcon={<LogOut className="h-4 w-4" />}
                  onClick={handleLogout}
                >
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Global Live RFID Tap Slide-Over Drawer for Tech & Admin */}
      {isTechOrAdmin && (
        <LiveTapDrawer
          open={tapState.drawerOpen}
          payload={tapState.latestTap}
          onClose={() => tapState.setDrawerOpen(false)}
          onResolved={() => tapState.clearLatestTap()}
        />
      )}
    </div>
  );
}
