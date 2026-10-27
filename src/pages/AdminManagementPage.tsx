import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Reveal } from '@/components/Reveal';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type DemotionRole = 'hr' | 'manager' | 'employee';

const demotionRoleLabels: Record<DemotionRole, string> = {
  hr: 'HR',
  manager: 'Manager',
  employee: 'Employee',
};

interface AdminAccount {
  employee_id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  department: string;
}

export function AdminManagementPage() {
  const { user } = useAuth();
  const { showToast } = useData();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccount | null>(null);
  const [demotionRole, setDemotionRole] = useState<DemotionRole | ''>('');

  const loadAdmins = useCallback(async (refresh = false) => {
    if (!isSupabaseConfigured() || !supabase) {
      setAdmins([]);
      setErrorMessage('Administrator management requires the connected Togetherly database.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc('list_active_admin_accounts');
      if (error) throw error;
      setAdmins((data ?? []) as AdminAccount[]);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Could not load administrator accounts.';
      setErrorMessage(message);
      setAdmins([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter((admin) =>
      [admin.full_name, admin.email, admin.department].some((field) => field.toLowerCase().includes(query)),
    );
  }, [admins, searchQuery]);

  async function handleRemoveAdmin() {
    if (!selectedAdmin || !demotionRole || !supabase || !isSupabaseConfigured()) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase.rpc('remove_admin_access', {
        p_employee_id: selectedAdmin.employee_id,
        p_target_role: demotionRole,
      });
      if (error) throw error;

      showToast('success', selectedAdmin.full_name + ' no longer has administrator access. Their account remains active as ' + demotionRoleLabels[demotionRole] + '.');
      setSelectedAdmin(null);
      setDemotionRole('');
      await loadAdmins(true);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'The administrator role could not be removed.';
      showToast('error', message);
      setErrorMessage(message);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Access"
        description="Manage who has administrator privileges for this Togetherly workspace."
        breadcrumb={['Home', 'Administration', 'Admin Access']}
        actions={
          <button type="button" className="btn-secondary" onClick={() => void loadAdmins(true)} disabled={isRefreshing || isLoading}>
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <Reveal>
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-base-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-2.5 text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Active administrators</h2>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary">
                  Remove admin privileges when someone no longer needs them, then choose whether their account should continue as HR, Manager, or Employee.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-md border border-base-border bg-base-bg px-3 py-2 text-xs text-text-secondary">
              <Users size={15} />
              <span><strong className="text-text-primary">{admins.length}</strong> active {admins.length === 1 ? 'admin' : 'admins'}</span>
            </div>
          </div>

          <div className="grid gap-3 border-b border-base-border bg-base-bg/50 p-4 sm:grid-cols-2 sm:p-5">
            <div className="flex items-start gap-2.5 rounded-md border border-base-border bg-white p-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-text-primary">Protected role changes</p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">The database verifies your admin role before allowing a change.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-md border border-base-border bg-white p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-text-primary">Last-admin protection</p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">You cannot remove your own access or demote the last active administrator.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-base-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative w-full sm:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                aria-label="Search administrators"
                className="input-field w-full pl-9"
                placeholder="Search name, email or department…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <p className="text-[11px] text-text-secondary">Role changes are recorded in the admin audit log.</p>
          </div>

          {errorMessage && (
            <div role="alert" className="m-4 flex items-start gap-2 rounded-md border border-critical/25 bg-critical/5 p-3 text-xs text-critical sm:m-5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-text-secondary">
              <RefreshCw size={16} className="animate-spin" /> Loading administrator accounts…
            </div>
          ) : !errorMessage && filteredAdmins.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="rounded-full border border-base-border bg-base-bg p-3 text-text-secondary"><Users size={22} /></div>
              <h3 className="mt-3 text-sm font-semibold text-text-primary">{admins.length === 0 ? 'No active administrator accounts found' : 'No matching administrators'}</h3>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
                {admins.length === 0 ? 'The database returned no linked active administrator accounts.' : 'Try searching with a different name, email address, or department.'}
              </p>
            </div>
          ) : !errorMessage ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-base-bg/70 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th scope="col" className="px-5 py-3">Administrator</th>
                    <th scope="col" className="px-4 py-3">Department</th>
                    <th scope="col" className="px-4 py-3">Access</th>
                    <th scope="col" className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border">
                  {filteredAdmins.map((admin) => {
                    const isCurrentAdmin = admin.auth_user_id === user?.id;
                    const cannotRemove = isCurrentAdmin || admins.length <= 1 || isRemoving;
                    return (
                      <tr key={admin.employee_id} className="transition-colors hover:bg-base-hover/50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5 text-xs font-semibold text-primary">
                              {admin.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-text-primary">
                                <span>{admin.full_name}</span>
                                {isCurrentAdmin && <span className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-medium text-primary">You</span>}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 break-all text-[11px] text-text-secondary"><Mail size={12} className="shrink-0" />{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-text-secondary"><span className="inline-flex items-center gap-1.5"><Building2 size={13} />{admin.department || 'Not assigned'}</span></td>
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary"><ShieldCheck size={12} />Administrator</span></td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            className="btn-secondary text-xs text-critical hover:border-critical/30 hover:bg-critical/5 disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={cannotRemove}
                            title={isCurrentAdmin ? 'You cannot remove your own administrator access.' : admins.length <= 1 ? 'At least one active administrator must remain.' : 'Remove administrator access'}
                             onClick={() => { setDemotionRole(''); setSelectedAdmin(admin); }}
                          >
                            <ShieldOff size={14} /> Remove access
                          </button>
                          {isCurrentAdmin && <p className="mt-1 text-[10px] text-text-muted">Current account</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="border-t border-base-border bg-base-bg/40 px-5 py-3 text-[10px] text-text-secondary">
            Removing admin access demotes the account to the role you select. It does not delete the account, employee profile, or historical records.
          </div>
        </section>
      </Reveal>

      <ConfirmationDialog
        open={Boolean(selectedAdmin)}
        onClose={() => { if (!isRemoving) { setSelectedAdmin(null); setDemotionRole(''); } }}
        onConfirm={() => { void handleRemoveAdmin(); }}
        title="Remove administrator access?"
        message={'This will remove administrator privileges from ' + (selectedAdmin?.full_name ?? 'this account') + (demotionRole ? ' and assign the role: ' + demotionRoleLabels[demotionRole] + '.' : '. Choose a new role below.') + ' Their account and work history will remain.'}
        details={
          <div className="space-y-3">
          <div className="space-y-2 rounded-md border border-base-border bg-base-bg p-3">
            <label htmlFor="demotion-role" className="block text-xs font-semibold text-text-primary">New position after admin access is removed</label>
            <select id="demotion-role" className="input-field w-full" value={demotionRole}
              onChange={(event) => setDemotionRole(event.target.value as DemotionRole | '')}
              disabled={isRemoving} required>
              <option value="">Choose a position…</option>
              <option value="hr">HR</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <p className="font-semibold">This action is audited.</p>
            <p className="mt-1">You cannot remove your own access or leave the workspace without an active administrator.</p>
          </div>
          </div>
        }
        confirmLabel={isRemoving ? 'Removing access…' : 'Remove admin access'}
        variant="danger"
        closeOnConfirm={false}
        confirmDisabled={isRemoving || !selectedAdmin || !demotionRole || selectedAdmin.auth_user_id === user?.id || admins.length <= 1}
      />
    </div>
  );
}
