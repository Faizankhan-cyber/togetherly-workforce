import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  LoaderCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { ProfileUpdateSection } from '@/components/ProfileUpdateSection';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { supabase } from '@/lib/supabase';

type EmployeePreferences = {
  projectUpdates: boolean;
  workloadWarnings: boolean;
  learningReminders: boolean;
  weeklySummary: boolean;
};

const defaultPreferences: EmployeePreferences = {
  projectUpdates: true,
  workloadWarnings: true,
  learningReminders: true,
  weeklySummary: false,
};

function readPreferences(key: string): EmployeePreferences {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultPreferences;
    const parsed = JSON.parse(stored) as Partial<EmployeePreferences>;
    return {
      projectUpdates: typeof parsed.projectUpdates === 'boolean' ? parsed.projectUpdates : defaultPreferences.projectUpdates,
      workloadWarnings: typeof parsed.workloadWarnings === 'boolean' ? parsed.workloadWarnings : defaultPreferences.workloadWarnings,
      learningReminders: typeof parsed.learningReminders === 'boolean' ? parsed.learningReminders : defaultPreferences.learningReminders,
      weeklySummary: typeof parsed.weeklySummary === 'boolean' ? parsed.weeklySummary : defaultPreferences.weeklySummary,
    };
  } catch {
    return defaultPreferences;
  }
}

export function EmployeeSettingsPage() {
  const employee = useCurrentEmployee();
  const { user, identityStatus, signOut, exitDemoMode } = useAuth();
  const { showToast } = useData();
  const navigate = useNavigate();
  const preferenceKey = `togetherly:employee-preferences:${user?.id ?? employee?.id ?? 'demo'}`;
  const [preferences, setPreferences] = useState<EmployeePreferences>(() => readPreferences(preferenceKey));
  const [saved, setSaved] = useState(true);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(employee?.avatarUrl ?? null);

  async function uploadAvatar(file?: File) {
    if (!file || !employee || !user || !supabase) return;
    if (!file.type.startsWith('image/')) { showToast('error', 'Choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'Profile pictures must be 5 MB or smaller.'); return; }
    setUploadingAvatar(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.from('employees').update({ avatar_url: data.publicUrl }).eq('id', employee.id).eq('auth_user_id', user.id);
      if (updateError) throw updateError;
      setAvatarPreview(avatarUrl);
      showToast('success', 'Profile picture updated.');
      window.dispatchEvent(new Event('togetherly:profile-updated'));
    } catch (error) { showToast('error', error instanceof Error ? error.message : 'Could not upload profile picture.'); }
    finally { setUploadingAvatar(false); if (avatarInputRef.current) avatarInputRef.current.value = ''; }
  }

  const preferenceItems: { key: keyof EmployeePreferences; label: string; description: string; icon: typeof Bell }[] = [
    { key: 'projectUpdates', label: 'Project updates', description: 'Keep project and assignment updates enabled in your preferences.', icon: BriefcaseBusiness },
    { key: 'workloadWarnings', label: 'Workload warnings', description: 'Enable a preference for capacity and workload alerts.', icon: Bell },
    { key: 'learningReminders', label: 'Learning reminders', description: 'Enable reminders for assigned courses and development goals.', icon: BookOpen },
    { key: 'weeklySummary', label: 'Weekly summary', description: 'Opt in to a weekly overview preference.', icon: Mail },
  ];

  function updatePreference(key: keyof EmployeePreferences, value: boolean) {
    setPreferences((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }

  function savePreferences() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      setSaved(true);
      showToast('success', 'Your personal preferences were saved on this device.');
    } catch {
      showToast('error', 'Could not save preferences in this browser.');
    }
  }

  async function handleSignOut() {
    if (user) await signOut();
    else exitDemoMode();
    navigate('/login', { replace: true });
  }

  if (!employee) {
    return (
      <div className="space-y-5">
        <PageHeader title="My Settings" description="Manage your account and personal preferences." breadcrumb={['Home', 'My Settings']} />
        <div className="card p-8 text-center">
          <ShieldCheck size={28} className="mx-auto text-warning" />
          <h2 className="mt-3 font-semibold text-text-primary">Employee profile not linked</h2>
          <p className="mt-2 text-sm text-text-secondary">Your account is not linked to an approved employee profile yet. Contact your manager or HR administrator.</p>
        </div>
      </div>
    );
  }

  const identityLabel = user ? (identityStatus === 'mapped' ? 'Verified employee account' : 'Account awaiting profile mapping') : 'Demo workspace';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Settings"
        description="Manage your personal account details, notification preferences and session."
        breadcrumb={['Home', 'My Settings']}
        actions={
          <button type="button" className="btn-primary" onClick={savePreferences} disabled={saved}>
            <Check size={15} /> {saved ? 'Preferences Saved' : 'Save Preferences'}
          </button>
        }
      />

      <ProfileUpdateSection />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
        <div className="space-y-5">
          <Reveal>
            <section className="card p-5 shadow-md border-base-border/70">
              <div className="flex items-center gap-2 pb-3 border-b border-base-border/60">
                <UserRound size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-text-primary">My Profile</h2>
              </div>
              <div className="flex items-center gap-3 py-5">
                <div className="relative shrink-0"><Avatar name={employee.name} color={employee.avatarColor} size="lg" imageUrl={avatarPreview ?? undefined} /><button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute -bottom-1 -right-1 rounded-full border border-base-border bg-surface p-1.5 text-text-primary shadow" aria-label="Upload profile picture">{uploadingAvatar ? <LoaderCircle size={13} className="animate-spin" /> : <Camera size={13} />}</button><input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-text-primary truncate">{employee.name}</div>
                  <div className="text-xs text-text-secondary">{employee.role}</div>
                  <div className="mt-1 text-[11px] text-success">{identityLabel}</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Full name', value: employee.name },
                  { label: 'Email address', value: employee.email || user?.email || 'Not available' },
                  { label: 'Department', value: employee.department || 'Not assigned' },
                  { label: 'Job title', value: employee.role || 'Not assigned' },
                ].map((field) => (
                  <div key={field.label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-base-border/40 pb-3 last:border-0 last:pb-0">
                    <span className="text-xs text-text-secondary">{field.label}</span>
                    <span className="text-xs font-semibold text-text-primary break-words">{field.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-text-secondary">These identity fields come from your linked employee record and are read-only here. Contact your manager or HR to correct them.</p>
            </section>
          </Reveal>

          <Reveal delay={60}>
            <section className="card p-5 shadow-md border-base-border/70">
              <div className="flex items-center gap-2 pb-3 border-b border-base-border/60">
                <KeyRound size={18} className="text-cyan" />
                <h2 className="text-sm font-bold text-text-primary">Account & Security</h2>
              </div>
              <div className="flex items-start gap-3 py-4">
                <div className="rounded-lg bg-success/10 border border-success/20 p-2 text-success"><ShieldCheck size={18} /></div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-text-primary">{user ? 'Signed in with your account' : 'Demo session active'}</div>
                  <p className="mt-1 text-[11px] text-text-secondary">{user ? 'Your workspace role is taken from your linked employee record.' : 'This is a demo profile. Sign-in security is not active in demo mode.'}</p>
                </div>
              </div>
              <button type="button" onClick={() => void handleSignOut()} className="btn-secondary w-full justify-center">
                <LogOut size={15} /> {user ? 'Sign Out' : 'Exit Demo Workspace'}
              </button>
            </section>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <section className="card p-5 shadow-md border-base-border/70">
            <div className="flex items-center gap-2 pb-3 border-b border-base-border/60">
              <Bell size={18} className="text-warning" />
              <h2 className="text-sm font-bold text-text-primary">Personal Preferences</h2>
            </div>
            <p className="text-xs text-text-secondary mt-3 mb-4">Choose which updates you want Togetherly to prioritize for you.</p>
            <div className="space-y-3">
              {preferenceItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center gap-3 p-3 rounded-xl bg-base-bg/60 border border-base-border/70">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon size={17} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-text-primary">{item.label}</div>
                      <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={preferences[item.key]}
                      aria-label={item.label}
                      onClick={() => updatePreference(item.key, !preferences[item.key])}
                      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${preferences[item.key] ? 'bg-primary' : 'bg-base-border'}`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${preferences[item.key] ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-warning/25 bg-warning/5 p-3 text-[11px] text-text-secondary leading-relaxed">
              These preferences are saved per account on this browser. Actual email delivery and push notifications require a configured notification service; these switches do not send messages by themselves.
            </div>
            {!saved && <p className="mt-3 text-xs text-warning">You have unsaved changes.</p>}
          </section>
        </Reveal>
      </div>
    </div>
  );
}
