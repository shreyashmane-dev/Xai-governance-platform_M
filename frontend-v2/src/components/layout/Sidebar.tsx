"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  BarChart3, 
  History, 
  Settings, 
  AlertTriangle,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Models', href: '/models', icon: ShieldCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Drift Monitor', href: '/drift', icon: AlertTriangle },
  { name: 'Datasets', href: '/datasets', icon: Database },
  { name: 'Audit Logs', href: '/logs', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r h-[calc(100vh-64px)] overflow-y-auto hidden md:block bg-card">
      <div className="p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
};
