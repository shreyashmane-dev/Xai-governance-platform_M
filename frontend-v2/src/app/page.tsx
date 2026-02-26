"use client";

import React, { useEffect, useState } from 'react';
import { ApiService } from '@/services/api-service';
import { 
  Activity, 
  ShieldCheck, 
  Database, 
  AlertCircle,
  TrendingUp,
  Cpu,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all group"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      {trend && (
        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
          {trend}
        </span>
      )}
    </div>
    <p className="text-sm text-muted-foreground font-medium">{title}</p>
    <h3 className="text-2xl font-bold mt-1">{value}</h3>
  </motion.div>
);

export default function Dashboard() {
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const status = await ApiService.checkHealth();
        setHealthStatus(status.status === 'ok' ? 'Online' : 'Warning');
      } catch (error) {
        setHealthStatus('Offline');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const stats = [
    { title: 'Active Models', value: '12', icon: ShieldCheck, color: 'bg-blue-500', trend: '+2 this month' },
    { title: 'Governance Score', value: '84/100', icon: Activity, color: 'bg-emerald-500', trend: '+4%' },
    { title: 'Datasets Tracked', value: '156 GB', icon: Database, color: 'bg-purple-500', trend: 'Healthy' },
    { title: 'Pending Alerts', value: '3', icon: AlertCircle, color: 'bg-amber-500', trend: '-12%' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Governance Dashboard</h2>
          <p className="text-muted-foreground mt-1">Real-time monitoring and compliance tracking for your AI ecosystem.</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-xl border">
          <div className={`h-2.5 w-2.5 rounded-full ${healthStatus === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">Backend: <span className={healthStatus === 'Online' ? 'text-emerald-500' : 'text-red-500'}>{healthStatus}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Model Drift Overview
              </h3>
              <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                View Report <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-xl bg-accent/30">
              <p className="text-muted-foreground text-sm italic">Analytics Visualization Placeholder</p>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-5 h-5 text-primary" />
                <h4 className="font-bold">Explainability Engine</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-4">SHAP-based global and local feature importance analysis for all validated models.</p>
              <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                Configure Engine
              </button>
            </div>
            <div className="bg-accent/50 border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <h4 className="font-bold">Recent Audits</h4>
              </div>
              <ul className="space-y-3">
                <li className="text-sm flex justify-between">
                  <span>Credit Risk Model v2</span>
                  <span className="text-xs text-muted-foreground">2m ago</span>
                </li>
                <li className="text-sm flex justify-between">
                  <span>Churn Prediction</span>
                  <span className="text-xs text-muted-foreground">1h ago</span>
                </li>
                <li className="text-sm flex justify-between">
                  <span>User Segment AI</span>
                  <span className="text-xs text-muted-foreground">Yesterday</span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Model Registry</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors border cursor-pointer">
                  <div className="h-10 w-10 rounded bg-blue-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold">XGB-Fraud-v{i + 1}</h5>
                    <p className="text-xs text-muted-foreground">Scikit-learn • {98 - i}% Acc</p>
                  </div>
                </div>
              ))}
              <button className="w-full border-2 border-dashed py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent/50 transition-colors">
                + Register New Model
              </button>
            </div>
          </section>

          <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold mb-2">Need Insights?</h3>
            <p className="text-sm text-blue-100 mb-4 font-light leading-relaxed">
              Our AI assistant can help you interpret model metrics and governance logs.
            </p>
            <button className="w-full bg-white text-blue-600 py-2.5 rounded-xl font-bold text-sm shadow-xl hover:bg-blue-50 transition-colors">
              Chat with Assistant
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
