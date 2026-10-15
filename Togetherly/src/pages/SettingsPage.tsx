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
import { useData } from '@/context/DataContext';
import type { AppSettings } from '@/types';

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
    setLocal(settings);
    showToast('success', 'Demo data has been reset to defaults');
  }

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, organization, and preferences"
        breadcrumb={['Home', 'Settings']}
        actions={
          hasChanges && (
            <button className="btn-primary" onClick={handleSave}>
              <Check size={16} /> Save Changes
            </button>
          )
        }
      />

      <div className="space-y-4 max-w-3xl">
        {/* User Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">User Profile</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Full Name</label>
              <input className="input-field w-full" defaultValue="Alex Morgan" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Email</label>
              <input className="input-field w-full" defaultValue="alex.morgan@togetherly.io" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Role</label>
              <input className="input-field w-full" defaultValue="Operations Lead" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Department</label>
              <input className="input-field w-full" defaultValue="Operations" />
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-3">This is a prototype — profile changes are not persisted.</p>
        </div>

        {/* Organization Preferences */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={18} className="text-cyan" />
            <h3 className="text-sm font-semibold text-text-primary">Organization Preferences</h3>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Organization Name</label>
            <input
              className="input-field w-full max-w-sm"
              value={local.organizationName}
              onChange={(e) => setLocal({ ...local, organizationName: e.target.value })}
            />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-warning" />
            <h3 className="text-sm font-semibold text-text-primary">Notification Preferences</h3>
          </div>
          <div className="space-y-3">
            {([
              { key: 'emailNotifications', label: 'Email notifications', desc: 'Receive email alerts for important events' },
              { key: 'workloadAlerts', label: 'Workload alerts', desc: 'Get notified when employees become overloaded' },
              { key: 'teamReminders', label: 'Team building reminders', desc: 'Reminders for incomplete team assignments' },
              { key: 'weeklyDigest', label: 'Weekly digest', desc: 'Summary of workforce activity every Monday' },
            ] as const).map((item) => (
              <label key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-base-bg border border-base-border cursor-pointer hover:border-base-hover transition-colors">
                <div>
                  <div className="text-sm text-text-primary">{item.label}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocal({ ...local, [item.key]: !local[item.key] })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${local[item.key] ? 'bg-primary' : 'bg-base-border'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${local[item.key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Workload Thresholds */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={18} className="text-success" />
            <h3 className="text-sm font-semibold text-text-primary">Workload Thresholds</h3>
          </div>
          <p className="text-xs text-text-secondary mb-4">Define when an employee is considered overloaded or underutilized.</p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-primary">Overloaded threshold</span>
                <span className="text-sm font-medium text-critical">{local.overloadedThreshold}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={100}
                value={local.overloadedThreshold}
                onChange={(e) => setLocal({ ...local, overloadedThreshold: Number(e.target.value) })}
                className="w-full accent-critical"
              />
              <p className="text-xs text-text-secondary mt-1">Employees at or above this utilization are flagged as overloaded.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-primary">Underutilized threshold</span>
                <span className="text-sm font-medium text-cyan">{local.underutilizedThreshold}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={local.underutilizedThreshold}
                onChange={(e) => setLocal({ ...local, underutilizedThreshold: Number(e.target.value) })}
                className="w-full accent-cyan"
              />
              <p className="text-xs text-text-secondary mt-1">Employees at or below this utilization are flagged as underutilized.</p>
            </div>
          </div>
        </div>

        {/* Demo Data Reset */}
        <div className="card p-5 border-critical/20">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw size={18} className="text-critical" />
            <h3 className="text-sm font-semibold text-text-primary">Demo Data Reset</h3>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Reset all employees, projects, assignments, and settings back to the original sample data. This cannot be undone.
          </p>
          <button className="btn-danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Reset Demo Data
          </button>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset Demo Data"
        message="This will permanently reset all employees, projects, assignments, and settings to their original values. Any changes you've made will be lost."
        confirmLabel="Reset Everything"
        variant="danger"
      />
    </div>
  );
}
