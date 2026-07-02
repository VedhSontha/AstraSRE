"use client";
import React, { useState } from "react";
import { Menu as MenuIcon, X, LayoutDashboard, Zap, Activity, Settings, Radio } from "lucide-react";

interface MenuItemProps {
  children?: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
}

function MenuItem({ icon, onClick, label }: MenuItemProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="relative flex items-center justify-center w-14 h-14 text-slate-400 hover:text-white transition-all duration-200 group"
    >
      <span className="h-6 w-6 transition-all duration-200 group-hover:scale-110">
        {icon}
      </span>
    </button>
  );
}

interface FluidMenuProps {
  onNavigate?: (section: string) => void;
}

export function FluidMenu({ onNavigate }: FluidMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const items = [
    { icon: <LayoutDashboard size={22} strokeWidth={1.5} />, label: "Dashboard", section: "dashboard" },
    { icon: <Zap size={22} strokeWidth={1.5} />, label: "Inject Chaos", section: "chaos" },
    { icon: <Activity size={22} strokeWidth={1.5} />, label: "Metrics", section: "metrics" },
    { icon: <Radio size={22} strokeWidth={1.5} />, label: "Live Logs", section: "logs" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-center gap-2">
      {/* Action items */}
      {items.map((item, i) => (
        <div
          key={item.section}
          className="transition-all duration-300 ease-out"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? `translateY(0)` : `translateY(${(i + 1) * 20}px)`,
            transitionDelay: isOpen ? `${i * 40}ms` : `${(items.length - i) * 30}ms`,
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          <div
            className="glass rounded-full shadow-lg cursor-pointer group flex items-center gap-2 px-3 py-2 border border-indigo-500/20 hover:border-indigo-400/40 transition-all"
            onClick={() => { onNavigate?.(item.section); setIsOpen(false); }}
          >
            <span className="text-indigo-400 group-hover:text-white transition-colors">{item.icon}</span>
            <span className="text-xs text-slate-400 group-hover:text-white transition-colors font-medium pr-1">{item.label}</span>
          </div>
        </div>
      ))}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative overflow-hidden"
        style={{
          background: isOpen
            ? 'linear-gradient(135deg,#ef4444,#dc2626)'
            : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          boxShadow: isOpen
            ? '0 0 30px rgba(239,68,68,0.4)'
            : '0 0 30px rgba(99,102,241,0.5)',
        }}
      >
        <div className="relative w-6 h-6">
          <div className={`absolute inset-0 transition-all duration-300 ${isOpen ? 'opacity-0 rotate-180 scale-0' : 'opacity-100 rotate-0 scale-100'}`}>
            <MenuIcon size={24} strokeWidth={1.5} className="text-white" />
          </div>
          <div className={`absolute inset-0 transition-all duration-300 ${isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-0'}`}>
            <X size={24} strokeWidth={1.5} className="text-white" />
          </div>
        </div>
      </button>
    </div>
  );
}
