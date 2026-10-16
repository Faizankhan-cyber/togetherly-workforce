import { useState } from 'react';
import {
  User,
  Building2,
  Bell,
  Sliders,
  RotateCcw,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import type { AppSettings } from '@/types';
import { defaultSettings } from '@/data/mockData';

export function SettingsPage() {
  const { settings, updateSettings, resetData, showToast } = useData();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleSave() {
    updateSettings(local);
    showToast('success', 'Settings saved successfully');
  }

  function handleReset() {
    resetData();
    setLocal(defaultSettings);
    showToast('success', 'Demo data has been reset to defaults');
  }

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Workspace Preferences"
        description="Configure matching weights, capacity alert thresholds, notifications, and demo environment."
        breadcrumb={['Home', 'Settings']}
        actions={
          hasChanges && (
            <button className="btn-primary" onClick={handleSave}>
              <Check size={16} /> Save Changes
            </button>
          )
        }
      />

      <div className="space-y-5 max-w-3xl">
        {/* User Profile */}
        <Reveal delay={0}>
          <div className="card p-5 border-base-border/70 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-base-border/50">
              <User size={18} className="text-primary" />
              <h3 className="text-sm font-bold text-text-primary">User Profile</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">Full Name</label>
                <input className="input-field w-full" defaultValue="Alex Morgan" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">Email</label>
                <input className="input-field w-full" defaultValue="alex.morgan@togetherly.io" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">Role</label>
                <input className="input-field w-full" defaultValue="Operations Lead" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">Department</label>
                <input className="input-field w-full" defaultValue="Operations" />
              </div>
            </div>
            <p className="text-[11px] text-text-secondary mt-3">Profile mock settings reflect currently active session administrator.</p>
          </div>
        </Reveal>

        {/* Organization Preferences */}
        <Reveal delay={60}>
          <div className="card p-5 border-base-border/70 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-base-border/50">
              <Building2 size={18} className="text-cyan" />
              <h3 className="text-sm font-bold text-text-primary">Organization Identity</h3>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">Workspace Name</label>
              <input
                className="input-field w-full max-w-sm"
                value={local.organizationName}
                onChange={(e) => setLocal({ ...local, organizationName: e.target.value })}
              />
            </div>
          </div>
        </Reveal>

        {/* Notification Preferences */}
        <Reveal delay={120}>
          <div className="card p-5 border-base-border/70 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-base-border/50">
              <Bell size={18} className="text-warning" />
              <h3 className="text-sm font-bold text-text-primary">Notification Subscriptions</h3>
            </div>
            <div className="space-y-3">
              {([
                { key: 'emailNotifications', label: 'Email notifications', desc: 'Receive email alerts for important events' },
                { key: 'workloadAlerts', label: 'Workload alerts', desc: 'Get notified when employees become overloaded' },
                { key: 'teamReminders', label: 'Team building reminders', desc: 'Reminders for incomplete team assignments' },
                { key: 'weeklyDigest', label: 'Weekly digest', desc: 'Summary of workforce activity every Monday' },
              ] as const).map((item) => (
                <label key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-base-bg/60 border border-base-border cursor-pointer hover:border-primary/40 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-text-primary">{item.label}</div>
                    <div className="text-[11px] text-text-secondary mt-0.5">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocal({ ...local, [item.key]: !local[item.key] })}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${local[item.key] ? 'bg-primary shadow-[0_0_10px_#8B5CF6]' : 'bg-base-border'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${local[item.key] ? 'left-6' : 'left-1'}`} />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Workload Thresholds */}
        <Reveal delay={180}>
          <div className="card p-5 border-base-border/70 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-base-border/50">
              <Sliders size={18} className="text-success" />
              <h3 className="text-sm font-bold text-text-primary">Capacity Rule Thresholds</h3>
            </div>
            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Define the percentage parameters determining when employees are marked overloaded or underutilized across all modules.
            </p>
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-base-bg/60 border border-base-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-text-primary">Overloaded Threshold</span>
                  <span className="text-xs font-mono font-bold text-critical bg-critical/10 px-2 py-0.5 rounded-md border border-critical/30">{local.overloadedThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={100}
                  value={local.overloadedThreshold}
                  onChange={(e) => setLocal({ ...local, overloadedThreshold: Number(e.target.value) })}
                  className="w-full accent-critical"
                />
                <p className="text-[11px] text-text-secondary mt-1">Staff at or above this percentage will trigger alerts.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-base-bg/60 border border-base-border/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-text-primary">Underutilized Threshold</span>
                  <span className="text-xs font-mono font-bold text-cyan bg-cyan/10 px-2 py-0.5 rounded-md border border-cyan/30">{local.underutilizedThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={local.underutilizedThreshold}
                  onChange={(e) => setLocal({ ...local, underutilizedThreshold: Number(e.target.value) })}
                  className="w-full accent-cyan"
                />
                <p className="text-[11px] text-text-secondary mt-1">Staff at or below this percentage will be surfaced in Opportunity Finder.</p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Demo Data Reset */}
        <Reveal delay={240}>
          <div className="card p-5 border-critical/30 shadow-md">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-base-border/50">
              <RotateCcw size={18} className="text-critical" />
              <h3 className="text-sm font-bold text-text-primary">Demo State Management</h3>
            </div>
            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Restore the original Togetherly mock dataset including 12 staff profiles, 6 projects, assignments, and activity logs.
            </p>
            <button className="btn-danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={15} /> Reset Demo Dataset
            </button>
          </div>
        </Reveal>
      </div>

      <ConfirmationDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset Demo Data"
        message="This will reset all employees, projects, simulations, and settings to original defaults. Any custom records created in this session will be replaced."
        confirmLabel="Reset Everything"
        variant="danger"
      />
    </div>
  );
}
