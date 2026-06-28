"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export interface NavPage {
  title: string;
  href: string;
  description?: string;
}

export interface NavSection {
  section: string;
  pages: NavPage[];
}

export const nav: NavSection[] = [
  {
    section: "Getting Started",
    pages: [
      { title: "Introduction", href: "/docs/introduction", description: "What Veil is and how it works" },
      { title: "Quick Start", href: "/docs/quick-start", description: "Integrate in 5 minutes" },
    ],
  },
  {
    section: "Reputation Model",
    pages: [
      { title: "Overview", href: "/docs/scoring-model", description: "How reputation bands are computed" },
    ],
  },
  {
    section: "Integration",
    pages: [
      { title: "Integration Guide", href: "/docs/integration", description: "Step-by-step guide" },
      { title: "SDK Guide", href: "/docs/integration/sdk", description: "Use @veil-protocol/sdk and React hooks" },
      { title: "Backend API", href: "/docs/integration/api-reference", description: "Sponsor and backup endpoints" },
    ],
  },
  {
    section: "User Guide",
    pages: [
      { title: "Using Veil", href: "/docs/user-guide", description: "Wallet, identity, reputation, and testnet flow" },
      { title: "Identity Anchor", href: "/docs/user-guide/ckb-wallet", description: "CKB lock-hash anchor" },
    ],
  },
  {
    section: "Concepts",
    pages: [
      { title: "Architecture", href: "/docs/concepts", description: "How everything fits together" },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`docs-sidebar-overlay${mobileOpen ? " active" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`docs-sidebar-col${mobileOpen ? " mobile-open" : ""}`}>
        {nav.map((group) => (
          <div className="nav-section" key={group.section}>
            <span className="nav-section-title">{group.section}</span>
            {group.pages.map((page) => {
              const isActive = pathname === page.href;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className={`nav-link${isActive ? " active" : ""}`}
                  onClick={onClose}
                >
                  {page.title}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
    </>
  );
}
