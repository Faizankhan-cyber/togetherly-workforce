import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Building2,
  BriefcaseBusiness,
  Mail,
  Calendar,
  X,
  Check,
  AlertTriangle,
  KeyRound,
  FileCheck2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { FilterToolbar, SelectFilter } from '@/components/FilterToolbar';
import { EmptyState } from '@/components/EmptyState';
import { Reveal } from '@/components/Reveal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import type {
  EmployeeRegistrationRequest,
  RegistrationRequestStatus,
  SystemRole,
} from '@/types';

const DEPARTMENT_OPTIONS = [
  'Engineering',
  'Product',
  'Design',
  'Data & AI',
  'Cloud & Infrastructure',
  'Security',
  'Quality Assurance',
  'Operations',
  'Human Resources',
];

const ROLE_OPTIONS: { value: SystemRole; label: string; description: string }[] = [
  {
    value: 'employee',
    label: 'Employee',
    description: 'Standard access to personal dashboard, assigned projects, and training claims.',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Access to team builder, project staffing, workload planning, and training verification.',
  },
  {
    value: 'hr',
    label: 'HR',
    description: 'Human Resources access to workforce directory, skill matrices, and compliance.',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full organization administration, employee verification & approval, and system settings.',
  },
];

const ROLE_LABELS: Record<SystemRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Administrator',
};

const ROLE_BADGE_STYLES: Record<SystemRole, string> = {
  employee: 'bg-slate-100 text-slate-700 border-slate-200',
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  hr: 'bg-purple-50 text-purple-700 border-purple-200',
  admin: 'bg-primary-50 text-primary border-primary-200',
};

function mapDbRowToRequest(row: Record<string, unknown>): EmployeeRegistrationRequest {
  const rawRole = row.assigned_role as string | null | undefined;
  const assignedRole: SystemRole | null =
    rawRole && ['employee', 'manager', 'hr', 'admin'].includes(rawRole)
      ? (rawRole as SystemRole)
      : null;

  const rawStatus = String(row.status || 'pending');
  const status: RegistrationRequestStatus = ['pending', 'approved', 'rejected'].includes(rawStatus)
    ? (rawStatus as RegistrationRequestStatus)
    : 'pending';

  return {
    id: String(row.id || ''),
    authUserId: String(row.auth_user_id || ''),
    applicantName: String(row.applicant_name || 'Applicant'),
    email: String(row.email || ''),
    requestedDepartment: String(row.requested_department || 'Engineering'),
    requestedJobTitle: (row.requested_job_title as string | null) ?? null,
    assignedRole,
    assignedDepartment: (row.assigned_department as string | null) ?? null,
    assignedJobTitle: (row.assigned_job_title as string | null) ?? null,
    employeeId: (row.employee_id as string | null) ?? null,
    status,
    reviewerId: (row.reviewer_id as string | null) ?? null,
    reviewerName: (row.reviewer_name as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function EmployeeVerificationPage() {
  const { user, isAdmin } = useAuth();
  const { employees, addEmployee, updateEmployee, showToast, addActivity } = useData();

  const [requests, setRequests] = useState<EmployeeRegistrationRequest[]>([]);
  const [dbEmployeeCount, setDbEmployeeCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Review drawer / modal state
  const [selectedRequest, setSelectedRequest] = useState<EmployeeRegistrationRequest | null>(null);
  const [selectedRole, setSelectedRole] = useState<SystemRole | ''>('employee');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Engineering');
  const [jobTitleInput, setJobTitleInput] = useState<string>('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [reviewActionMode, setReviewActionMode] = useState<'idle' | 'confirm-approve' | 'reject-form' | 'confirm-reject'>('idle');
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  const fetchVerificationData = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured() || !supabase) {
      setErrorMessage(
        'Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to load live registration requests.'
      );
      setIsLoading(false);
      return;
    }

    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage(null);

    try {
      // 1. Synchronize any newly registered auth.users accounts into public.employee_registration_requests
      try {
        await supabase.rpc('sync_missing_registration_requests');
      } catch {
        // Ignore if RPC is not yet applied
      }

      // 2. Fetch all registration requests ordered by registration date descending
      const { data: reqData, error: reqError } = await supabase
        .from('employee_registration_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqError) {
        const lowerMsg = reqError.message.toLowerCase();
        if (
          reqError.code === '42P01' ||
          reqError.code === 'PGRST205' ||
          lowerMsg.includes('employee_registration_requests')
        ) {
          setErrorMessage(
            'The employee_registration_requests table was not found in Supabase. Please apply the latest SQL migration (supabase/migrations/20261016_initial_schema.sql or supabase/migrations/20261023_employee_registration_requests.sql) in your Supabase SQL Editor.'
          );
        } else {
          setErrorMessage(`Failed to load employee registration requests: ${reqError.message}`);
        }
        return;
      }

      const mappedRequests = (reqData || []).map((row) =>
        mapDbRowToRequest(row as Record<string, unknown>)
      );
      setRequests(mappedRequests);

      // 3. Fetch total employees count from public.employees
      const { count: empCount, error: empCountErr } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true });

      if (!empCountErr && typeof empCount === 'number') {
        setDbEmployeeCount(empCount);
      }
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || 'An unexpected error occurred while fetching registration requests.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchVerificationData(true);
  }, [fetchVerificationData]);

  // Open review modal and initialize form controls from the selected application
  const openReviewModal = (req: EmployeeRegistrationRequest) => {
    setSelectedRequest(req);
    setSelectedRole(req.assignedRole || 'employee');
    setSelectedDepartment(req.assignedDepartment || req.requestedDepartment || 'Engineering');
    setJobTitleInput(req.assignedJobTitle || req.requestedJobTitle || '');
    setRejectionReasonInput(req.rejectionReason || '');
    setReviewActionMode('idle');
    setFormValidationError(null);
  };

  const closeReviewModal = () => {
    if (isSubmittingDecision) return;
    setSelectedRequest(null);
    setReviewActionMode('idle');
    setFormValidationError(null);
  };

  // Step 1 of Approval: Validate Role & Department, then prompt for explicit confirmation
  const handleInitiateApprove = () => {
    setFormValidationError(null);
    if (!isAdmin) {
      setFormValidationError('Access denied: Only authorized administrators can approve applications.');
      return;
    }
    if (!selectedRole || !['employee', 'manager', 'hr', 'admin'].includes(selectedRole)) {
      setFormValidationError('Please select an assigned organization role before approving.');
      return;
    }
    if (!selectedDepartment || !selectedDepartment.trim()) {
      setFormValidationError('Please select a department before approving.');
      return;
    }
    setReviewActionMode('confirm-approve');
  };

  // Step 2 of Approval: Execute database RPC after explicit confirmation
  const handleConfirmApprove = async () => {
    if (!selectedRequest || !supabase || isSubmittingDecision) return;
    if (!isAdmin) {
      setFormValidationError('Access denied: Only authorized administrators can approve applications.');
      return;
    }
    if (!selectedRole || !selectedDepartment.trim()) {
      setFormValidationError('Both role and department are required for approval.');
      return;
    }

    setIsSubmittingDecision(true);
    setFormValidationError(null);

    try {
      const { data, error } = await supabase.rpc('approve_employee_registration_request', {
        p_request_id: selectedRequest.id,
        p_assigned_role: selectedRole,
        p_assigned_department: selectedDepartment.trim(),
        p_assigned_job_title: jobTitleInput.trim() || null,
      });

      if (error) {
        setFormValidationError(error.message || 'Failed to approve application.');
        showToast('error', error.message || 'Approval failed.');
        return;
      }

      const updatedReq =
        data && typeof data === 'object'
          ? mapDbRowToRequest(data as Record<string, unknown>)
          : {
              ...selectedRequest,
              status: 'approved' as const,
              assignedRole: selectedRole,
              assignedDepartment: selectedDepartment.trim(),
              assignedJobTitle: jobTitleInput.trim() || selectedRequest.requestedJobTitle || 'Workforce Specialist',
              reviewedAt: new Date().toISOString(),
              rejectionReason: null,
            };

      setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
      setDbEmployeeCount((prev) =>
        selectedRequest.status !== 'approved' && prev !== null ? prev + 1 : prev
      );

      // Sync approved employee into local DataContext directory if not already present
      const empId = updatedReq.employeeId || `emp-${updatedReq.authUserId.slice(0, 8)}`;
      const existingEmp = employees.find(
        (e) => e.id === empId || e.email.toLowerCase() === updatedReq.email.toLowerCase()
      );
      const resolvedTitle =
        updatedReq.assignedJobTitle ||
        ROLE_LABELS[selectedRole] ||
        'Workforce Specialist';

      if (existingEmp) {
        updateEmployee(existingEmp.id, {
          name: updatedReq.applicantName,
          email: updatedReq.email,
          department: selectedDepartment.trim(),
          role: resolvedTitle,
          systemRole: selectedRole,
        });
      } else {
        addEmployee({
          id: empId,
          authUserId: updatedReq.authUserId,
          name: updatedReq.applicantName,
          email: updatedReq.email,
          department: selectedDepartment.trim(),
          role: resolvedTitle,
          systemRole: selectedRole,
          avatarColor: '#0078D4',
          availability: 'available',
          yearsExperience: 3,
          targetUtilization: 100,
          skills: [],
          trainingAssignments: [],
        });
      }

      const msg = `Approved ${updatedReq.applicantName} as ${ROLE_LABELS[selectedRole]} in ${selectedDepartment.trim()}.`;
      setSuccessBanner(msg);
      showToast('success', msg);
      addActivity(msg, 'system');
      setSelectedRequest(null);
      setReviewActionMode('idle');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Unexpected error approving application.';
      setFormValidationError(msg);
      showToast('error', msg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Step 1 of Rejection: Open rejection reason field or proceed to explicit confirmation
  const handleInitiateReject = () => {
    setFormValidationError(null);
    if (!isAdmin) {
      setFormValidationError('Access denied: Only authorized administrators can reject applications.');
      return;
    }
    if (selectedRequest?.authUserId === user?.id) {
      setFormValidationError('You cannot reject your own active administrator account.');
      return;
    }
    if (reviewActionMode !== 'reject-form' && reviewActionMode !== 'confirm-reject') {
      setReviewActionMode('reject-form');
      return;
    }
    setReviewActionMode('confirm-reject');
  };

  // Step 2 of Rejection: Execute database RPC after explicit confirmation
  const handleConfirmReject = async () => {
    if (!selectedRequest || !supabase || isSubmittingDecision) return;
    if (!isAdmin) {
      setFormValidationError('Access denied: Only authorized administrators can reject applications.');
      return;
    }

    setIsSubmittingDecision(true);
    setFormValidationError(null);

    try {
      const { data, error } = await supabase.rpc('reject_employee_registration_request', {
        p_request_id: selectedRequest.id,
        p_rejection_reason: rejectionReasonInput.trim() || null,
      });

      if (error) {
        setFormValidationError(error.message || 'Failed to reject application.');
        showToast('error', error.message || 'Rejection failed.');
        return;
      }

      const updatedReq =
        data && typeof data === 'object'
          ? mapDbRowToRequest(data as Record<string, unknown>)
          : {
              ...selectedRequest,
              status: 'rejected' as const,
              rejectionReason: rejectionReasonInput.trim() || null,
              reviewedAt: new Date().toISOString(),
            };

      setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
      if (selectedRequest.status === 'approved' && dbEmployeeCount !== null) {
        setDbEmployeeCount(Math.max(0, dbEmployeeCount - 1));
      }

      const msg = `Rejected registration application for ${updatedReq.applicantName}.`;
      setSuccessBanner(msg);
      showToast('warning', msg);
      addActivity(msg, 'system');
      setSelectedRequest(null);
      setReviewActionMode('idle');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Unexpected error rejecting application.';
      setFormValidationError(msg);
      showToast('error', msg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Summary metrics
  const summaryStats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const totalEmployees = dbEmployeeCount !== null ? dbEmployeeCount : employees.length;
    return { pending, approved, rejected, totalEmployees };
  }, [requests, dbEmployeeCount, employees.length]);

  // Dynamic department list combining standard departments and any custom values in requests
  const allDepartments = useMemo(() => {
    const set = new Set<string>(DEPARTMENT_OPTIONS);
    requests.forEach((r) => {
      if (r.requestedDepartment) set.add(r.requestedDepartment);
      if (r.assignedDepartment) set.add(r.assignedDepartment);
    });
    return Array.from(set).sort();
  }, [requests]);

  // Filtered applications
  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;

      if (departmentFilter !== 'all') {
        const effectiveDept = req.assignedDepartment || req.requestedDepartment;
        if (effectiveDept !== departmentFilter && req.requestedDepartment !== departmentFilter) {
          return false;
        }
      }

      if (roleFilter !== 'all') {
        if (roleFilter === 'unassigned') {
          if (req.assignedRole) return false;
        } else if (req.assignedRole !== roleFilter) {
          return false;
        }
      }

      if (q) {
        const haystack = [
          req.applicantName,
          req.email,
          req.requestedDepartment,
          req.assignedDepartment || '',
          req.requestedJobTitle || '',
          req.assignedJobTitle || '',
          req.assignedRole ? ROLE_LABELS[req.assignedRole] : 'unassigned',
          req.status,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter, departmentFilter, roleFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    roleFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setRoleFilter('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Verification"
        description="Review registrations, verify employee details and manage organization access."
        breadcrumb={['Home', 'Administration', 'Employee Verification']}
        actions={
          <button
            type="button"
            onClick={() => void fetchVerificationData(false)}
            disabled={isLoading || isRefreshing}
            className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-primary' : ''} />
            <span>{isRefreshing ? 'Syncing Queue…' : 'Refresh Queue'}</span>
          </button>
        }
      />

      {/* Summary Cards */}
      <Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Pending Requests"
            value={summaryStats.pending}
            icon={<Clock size={18} />}
            accent="warning"
          />
          <MetricCard
            label="Approved"
            value={summaryStats.approved}
            icon={<CheckCircle2 size={18} />}
            accent="success"
          />
          <MetricCard
            label="Rejected"
            value={summaryStats.rejected}
            icon={<XCircle size={18} />}
            accent="critical"
          />
          <MetricCard
            label="Total Employees"
            value={summaryStats.totalEmployees}
            icon={<Users size={18} />}
            accent="primary"
          />
        </div>
      </Reveal>

      {/* Success Banner */}
      {successBanner && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded"
            aria-label="Dismiss success banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error State Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900 mb-0.5">
                Verification Queue Connection Error
              </div>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchVerificationData(true)}
            className="btn-secondary text-xs px-3 py-1.5 border-rose-300 text-rose-800 hover:bg-rose-100 shrink-0 self-start sm:self-center"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Search & Filters Card */}
      <Reveal delay={50}>
        <div className="card bg-white border border-base-border p-4 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by applicant name, email, department, or role…"
                className="input-field pl-8 pr-8 py-1.5 w-full text-xs bg-base-bg focus:bg-white"
                aria-label="Search employee registration applications"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="text-xs text-text-secondary font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" />
              <span>
                Showing <strong className="font-mono text-text-primary">{filteredRequests.length}</strong> of{' '}
                <strong className="font-mono text-text-primary">{requests.length}</strong> applications
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-base-border">
            <FilterToolbar onReset={hasActiveFilters ? resetFilters : undefined}>
              <SelectFilter
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
              <SelectFilter
                label="Department"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...allDepartments.map((d) => ({ value: d, label: d })),
                ]}
              />
              <SelectFilter
                label="Assigned Role"
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'unassigned', label: 'Unassigned' },
                  { value: 'employee', label: 'Employee' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'hr', label: 'HR' },
                  { value: 'admin', label: 'Administrator' },
                ]}
              />
            </FilterToolbar>
          </div>
        </div>
      </Reveal>

      {/* Applications Table */}
      <Reveal delay={100}>
        <div className="card bg-white border border-base-border overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-base-border" aria-busy="true" aria-label="Loading applications">
              <div className="bg-base-subtle px-4 py-3 border-b border-base-border">
                <div className="h-3.5 w-48 bg-gray-200 rounded animate-pulse" />
              </div>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="px-4 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                    <div className="space-y-1.5 flex-1 max-w-xs">
                      <div className="h-3.5 w-36 bg-gray-200 rounded animate-pulse" />
                      <div className="h-2.5 w-48 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-3 w-24 bg-gray-100 rounded animate-pulse hidden sm:block" />
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UserCheck size={24} />}
                title={
                  hasActiveFilters
                    ? 'No matching registration requests'
                    : 'No employee registration requests found'
                }
                description={
                  hasActiveFilters
                    ? 'Try adjusting your search query or resetting the status, department, and role filters.'
                    : 'When new users sign up via Supabase Authentication, their applications will automatically appear here for administrator verification.'
                }
                action={
                  hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="btn-secondary text-xs px-3.5 py-1.5"
                    >
                      Reset Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void fetchVerificationData(true)}
                      className="btn-secondary text-xs px-3.5 py-1.5"
                    >
                      Refresh Queue
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-base-subtle border-b border-base-border text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    <th className="py-3 px-4">Applicant name</th>
                    <th className="py-3 px-4">Email address</th>
                    <th className="py-3 px-4">Registration date</th>
                    <th className="py-3 px-4">Requested department</th>
                    <th className="py-3 px-4">Assigned role</th>
                    <th className="py-3 px-4">Application status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border text-xs">
                  {filteredRequests.map((req) => {
                    const effectiveJobTitle = req.assignedJobTitle || req.requestedJobTitle;
                    const isSelf = req.authUserId === user?.id;

                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-base-hover transition-colors group"
                      >
                        {/* Applicant name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={req.applicantName} color="#0078D4" size="sm" />
                            <div className="min-w-0">
                              <div className="font-bold text-text-primary truncate flex items-center gap-1.5">
                                <span>{req.applicantName}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary-50 text-primary border border-primary-200">
                                    You
                                  </span>
                                )}
                              </div>
                              {effectiveJobTitle ? (
                                <div className="text-[11px] text-text-secondary truncate">
                                  {effectiveJobTitle}
                                </div>
                              ) : (
                                <div className="text-[10px] text-text-muted font-mono truncate">
                                  UID: {req.authUserId.slice(0, 8)}…
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email address */}
                        <td className="py-3 px-4 font-mono text-[11px] text-text-primary">
                          {req.email}
                        </td>

                        {/* Registration date */}
                        <td className="py-3 px-4 font-mono text-[11px] text-text-secondary tabular-nums whitespace-nowrap">
                          <div>
                            {new Date(req.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {new Date(req.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Requested department */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-text-primary">
                            {req.requestedDepartment}
                          </div>
                          {req.assignedDepartment &&
                            req.assignedDepartment !== req.requestedDepartment && (
                              <div className="text-[10px] text-primary font-semibold mt-0.5">
                                Assigned: {req.assignedDepartment}
                              </div>
                            )}
                        </td>

                        {/* Assigned role */}
                        <td className="py-3 px-4">
                          {req.assignedRole ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                ROLE_BADGE_STYLES[req.assignedRole]
                              }`}
                            >
                              {ROLE_LABELS[req.assignedRole]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-text-muted border border-base-border">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Application status */}
                        <td className="py-3 px-4">
                          <StatusBadge status={req.status} />
                          {req.reviewedAt && (
                            <div className="text-[10px] text-text-muted mt-0.5 font-mono tabular-nums">
                              {new Date(req.reviewedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReviewModal(req)}
                            className={
                              req.status === 'pending'
                                ? 'btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5'
                                : 'btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5'
                            }
                          >
                            <FileCheck2 size={13} />
                            <span>Review Application</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>

      {/* Application Review Drawer / Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-base-border flex flex-col justify-between overflow-y-auto animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-drawer-title"
          >
            {/* Top Drawer Header */}
            <div>
              <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-subtle sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 border border-primary-200 text-primary flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        id="review-drawer-title"
                        className="text-sm sm:text-base font-bold text-text-primary"
                      >
                        Review Employee Application
                      </h2>
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                    <p className="text-[11px] text-text-secondary font-mono mt-0.5">
                      Request ID: {selectedRequest.id.slice(0, 13)}…
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={isSubmittingDecision}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-base-hover transition-colors"
                  aria-label="Close review drawer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-6">
                {/* Validation / Action Error Banner */}
                {formValidationError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <span>{formValidationError}</span>
                  </div>
                )}

                {/* Section 1: Applicant Identity & Registration Details */}
                <div className="rounded-xl border border-base-border bg-base-subtle/60 p-4 space-y-3">
                  <div className="flex items-center gap-3 pb-3 border-b border-base-border">
                    <Avatar name={selectedRequest.applicantName} color="#0078D4" size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-text-primary truncate">
                        {selectedRequest.applicantName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary font-mono truncate mt-0.5">
                        <Mail size={12} className="text-text-muted shrink-0" />
                        <span>{selectedRequest.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-base-border">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <Calendar size={11} /> Registration Date
                      </div>
                      <div className="font-mono font-semibold text-text-primary mt-1 tabular-nums">
                        {new Date(selectedRequest.createdAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-base-border">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <Building2 size={11} /> Requested Department
                      </div>
                      <div className="font-semibold text-text-primary mt-1">
                        {selectedRequest.requestedDepartment}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-base-border">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <BriefcaseBusiness size={11} /> Requested Job Title
                      </div>
                      <div className="font-medium text-text-primary mt-1">
                        {selectedRequest.requestedJobTitle || 'Not specified'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-base-border">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <KeyRound size={11} /> Supabase Auth User ID
                      </div>
                      <div
                        className="font-mono text-[11px] text-text-secondary mt-1 truncate"
                        title={selectedRequest.authUserId}
                      >
                        {selectedRequest.authUserId}
                      </div>
                    </div>
                  </div>

                  {/* Previous review metadata if already reviewed */}
                  {selectedRequest.reviewedAt && (
                    <div className="pt-2 border-t border-base-border text-[11px] text-text-secondary flex flex-col gap-1">
                      <div>
                        Last reviewed by{' '}
                        <strong className="text-text-primary">
                          {selectedRequest.reviewerName || 'Administrator'}
                        </strong>{' '}
                        on{' '}
                        <span className="font-mono">
                          {new Date(selectedRequest.reviewedAt).toLocaleString()}
                        </span>
                      </div>
                      {selectedRequest.employeeId && (
                        <div>
                          Linked Employee Record:{' '}
                          <span className="font-mono font-semibold text-primary">
                            {selectedRequest.employeeId}
                          </span>
                        </div>
                      )}
                      {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 mt-1">
                          <strong>Recorded Rejection Reason:</strong> {selectedRequest.rejectionReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: Role & Department Assignment Controls */}
                <div className="space-y-4">
                  <div className="border-b border-base-border pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Organization Role & Department Assignment
                    </h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Assign the applicant’s authoritative RBAC role and department before approving access.
                    </p>
                  </div>

                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-2">
                      Assigned Organization Role <span className="text-critical">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ROLE_OPTIONS.map((option) => {
                        const isSelected = selectedRole === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isSubmittingDecision}
                            onClick={() => {
                              setSelectedRole(option.value);
                              setFormValidationError(null);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-primary bg-primary-50/70 ring-2 ring-primary/20'
                                : 'border-base-border bg-white hover:bg-base-hover'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span
                                className={`text-xs font-bold ${
                                  isSelected ? 'text-primary' : 'text-text-primary'
                                }`}
                              >
                                {option.label}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-gray-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check size={10} />}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-snug">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Department Selector & Optional Job Title */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label
                        htmlFor="assign-department-select"
                        className="block text-xs font-semibold text-text-primary mb-1"
                      >
                        Assigned Department <span className="text-critical">*</span>
                      </label>
                      <select
                        id="assign-department-select"
                        value={selectedDepartment}
                        disabled={isSubmittingDecision}
                        onChange={(e) => {
                          setSelectedDepartment(e.target.value);
                          setFormValidationError(null);
                        }}
                        className="input-field w-full py-2 px-3 text-xs bg-white"
                      >
                        <option value="">Select department…</option>
                        {allDepartments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="assign-job-title-input"
                        className="block text-xs font-semibold text-text-primary mb-1"
                      >
                        Job Title <span className="text-[10px] text-text-muted font-normal">(Optional)</span>
                      </label>
                      <input
                        id="assign-job-title-input"
                        type="text"
                        value={jobTitleInput}
                        disabled={isSubmittingDecision}
                        onChange={(e) => setJobTitleInput(e.target.value)}
                        placeholder="e.g. Senior Workforce Analyst"
                        className="input-field w-full py-2 px-3 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Rejection Reason Input when Rejecting */}
                {(reviewActionMode === 'reject-form' || reviewActionMode === 'confirm-reject') && (
                  <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2.5 animate-fade-in">
                    <label
                      htmlFor="rejection-reason-textarea"
                      className="block text-xs font-bold text-rose-900"
                    >
                      Rejection Reason (Saved to Application Record)
                    </label>
                    <textarea
                      id="rejection-reason-textarea"
                      rows={3}
                      value={rejectionReasonInput}
                      disabled={isSubmittingDecision}
                      onChange={(e) => setRejectionReasonInput(e.target.value)}
                      placeholder="Provide a clear reason for rejecting this registration request (e.g., Unrecognized contractor email, department headcount freeze)…"
                      className="input-field w-full p-2.5 text-xs bg-white border-rose-200 focus:border-rose-500"
                    />
                  </div>
                )}

                {/* Explicit Confirmation Box for Approval */}
                {reviewActionMode === 'confirm-approve' && (
                  <div className="p-4 rounded-xl bg-primary-50 border border-primary-200 space-y-3 animate-fade-in">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="text-xs text-text-primary leading-relaxed">
                        <div className="font-bold text-primary mb-0.5">
                          Confirm Application Approval
                        </div>
                        Are you sure you want to approve{' '}
                        <strong>{selectedRequest.applicantName}</strong> ({selectedRequest.email}) and
                        provision their workforce profile with role{' '}
                        <strong>{selectedRole ? ROLE_LABELS[selectedRole] : ''}</strong> in the{' '}
                        <strong>{selectedDepartment}</strong> department?
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => setReviewActionMode('idle')}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => void handleConfirmApprove()}
                        className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                      >
                        {isSubmittingDecision ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Approving & Provisioning…</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Confirm Approval</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Explicit Confirmation Box for Rejection */}
                {reviewActionMode === 'confirm-reject' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3 animate-fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-950 leading-relaxed">
                        <div className="font-bold text-rose-800 mb-0.5">
                          Confirm Application Rejection
                        </div>
                        Are you sure you want to reject{' '}
                        <strong>{selectedRequest.applicantName}</strong>’s registration request? They
                        will be denied access to Togetherly workforce modules.
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => setReviewActionMode('reject-form')}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => void handleConfirmReject()}
                        className="btn-danger text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                      >
                        {isSubmittingDecision ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Rejecting Application…</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} />
                            <span>Confirm Rejection</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="px-6 py-4 border-t border-base-border bg-base-subtle flex flex-wrap items-center justify-between gap-2.5 sticky bottom-0">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={isSubmittingDecision}
                className="btn-secondary text-xs px-3.5 py-2"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {reviewActionMode === 'reject-form' ? (
                  <>
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => setReviewActionMode('idle')}
                      className="btn-secondary text-xs px-3 py-2"
                    >
                      Cancel Rejection
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={handleInitiateReject}
                      className="btn-danger text-xs px-4 py-2 flex items-center gap-1.5"
                    >
                      <XCircle size={14} />
                      <span>Reject Application</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={
                        isSubmittingDecision ||
                        reviewActionMode === 'confirm-approve' ||
                        reviewActionMode === 'confirm-reject' ||
                        selectedRequest.authUserId === user?.id
                      }
                      onClick={handleInitiateReject}
                      title={
                        selectedRequest.authUserId === user?.id
                          ? 'You cannot reject your own administrator account'
                          : undefined
                      }
                      className="btn-danger text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>Reject Application</span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSubmittingDecision ||
                        reviewActionMode === 'confirm-approve' ||
                        reviewActionMode === 'confirm-reject'
                      }
                      onClick={handleInitiateApprove}
                      className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>Approve Application</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
