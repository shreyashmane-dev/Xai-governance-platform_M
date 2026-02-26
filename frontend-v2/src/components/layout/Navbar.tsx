"use client";

import React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Navbar = () => {
  const { theme, setTheme } = useTheme();

  return (
    <nav className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          XAI Governance
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="h-8 w-[1px] bg-border mx-2" />

        <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-accent transition-colors border">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <User className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium mr-1 hidden sm:inline">Admin</span>
        </button>
      </div>
    </nav>
  );
};
