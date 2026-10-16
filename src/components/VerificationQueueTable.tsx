import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  HelpCircle,
  Clock,
  Award,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import type { TrainingSubmission } from '@/types';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { SkillTag } from '@/components/SkillTag';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/utils';
import { useData } from '@/context/DataContext';

interface VerificationQueueTableProps {
  onSelectSubmission: (submission: TrainingSubmission) => void;
}

export function VerificationQueueTable({ onSelectSubmission }: VerificationQueueTableProps) {
  const { submissions, employees } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department))).sort();
  }, [employees]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === 'pending-verification').length;
    const verified = submissions.filter((s) => s.status === 'verified').length;
    const rejected = submissions.filter((s) => s.status === 'rejected').length;
    const needsEvidence = submissions.filter((s) => s.status === 'needs-more-evidence').length;
    return { total, pending, verified, rejected, needsEvidence };
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && s.employeeDepartment !== departmentFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = s.employeeName.toLowerCase().includes(query);
        const matchesCourse = s.courseName.toLowerCase().includes(query);
        const matchesProvider = s.provider.toLowerCase().includes(query);
        const matchesCredId = s.credentialId?.toLowerCase().includes(query) ?? false;
        const matchesDept = s.employeeDepartment.toLowerCase().includes(query);
        if (!matchesName && !matchesCourse && !matchesProvider && !matchesCredId && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, statusFilter, departmentFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 border-base-border/80">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Submissions</span>
            <Award size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary tracking-tight">{stats.total}</div>
          <div className="text-[11px] text-text-secondary mt-1">Recorded training claims</div>
        </div>

        <div className="card p-4 border-amber-300 bg-amber-50/40">
          <div className="flex items-center justify-between text-amber-900 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Review</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-900 tracking-tight">{stats.pending}</div>
          <div className="text-[11px] text-amber-800 mt-1">Awaiting verification decision</div>
        </div>

        <div className="card p-4 border-emerald-300 bg-emerald-50/40">
          <div className="flex items-center justify-between text-emerald-900 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Verified Achievements</span>
            <ShieldCheck size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 tracking-tight">{stats.verified}</div>
          <div className="text-[11px] text-emerald-800 mt-1">Accredited by reviewer</div>
        </div>

        <div className="card p-4 border-indigo-200 bg-indigo-50/30">
          <div className="flex items-center justify-between text-indigo-900 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Evidence Requested</span>
            <HelpCircle size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-900 tracking-tight">{stats.needsEvidence}</div>
          <div className="text-[11px] text-indigo-800 mt-1">
            {stats.rejected} rejected · awaiting updates
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 sm:p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search by employee, course, provider, credential ID..."
            className="input-field pl-8 w-full text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Filter size={13} />
            <span>Filter:</span>
          </div>

          <select
            className="input-field text-xs py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Verification Statuses</option>
            <option value="pending-verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="needs-more-evidence">Needs More Evidence</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            className="input-field text-xs py-1"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card overflow-hidden bg-white">
        {filteredSubmissions.length === 0 ? (
          <EmptyState
            title="No verification submissions match your filter"
            description="Try adjusting your search criteria, status filter, or check back once employees submit course claims."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-base-border bg-base-subtle text-text-secondary">
                  <th className="py-3 px-4 font-semibold">Employee</th>
                  <th className="py-3 px-4 font-semibold">Course & Provider</th>
                  <th className="py-3 px-3 font-semibold">Competency</th>
                  <th className="py-3 px-3 font-semibold">Completion Date</th>
                  <th className="py-3 px-3 font-semibold">Submission Date</th>
                  <th className="py-3 px-3 font-semibold">Evidence Attached</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/60">
                {filteredSubmissions.map((sub) => {
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onSelectSubmission(sub)}
                      className="hover:bg-base-hover cursor-pointer transition-colors group"
                    >
                      {/* Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={sub.employeeName}
                            color={sub.employeeAvatarColor || '#0078D4'}
                            size="sm"
                          />
                          <div>
                            <div className="font-bold text-text-primary group-hover:text-primary transition-colors">
                              {sub.employeeName}
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              {sub.employeeRole} · {sub.employeeDepartment}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Course & Provider */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text-primary">{sub.courseName}</div>
                        <div className="text-[11px] text-text-secondary">{sub.provider}</div>
                      </td>

                      {/* Skill Tag */}
                      <td className="py-3 px-3">
                        <SkillTag skillId={sub.skillId} />
                      </td>

                      {/* Completion Date */}
                      <td className="py-3 px-3 text-text-secondary font-mono">
                        {formatDate(sub.completionDate)}
                      </td>

                      {/* Submission Date */}
                      <td className="py-3 px-3 text-text-secondary font-mono">
                        {formatDate(sub.submissionDate)}
                      </td>

                      {/* Evidence Indicators */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {sub.evidenceFileType === 'pdf' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]"
                              title="PDF Document"
                            >
                              <FileText size={11} /> PDF
                            </span>
                          )}
                          {sub.evidenceFileType === 'image' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan/15 text-cyan font-semibold text-[10px]"
                              title="Image Certificate"
                            >
                              <ImageIcon size={11} /> Image
                            </span>
                          )}
                          {sub.verificationUrl && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-text-secondary font-semibold text-[10px]"
                              title="Verification Registry Link"
                            >
                              <LinkIcon size={11} /> Link
                            </span>
                          )}
                          {!sub.evidenceDataUrl && !sub.verificationUrl && (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <StatusBadge status={sub.status} />
                      </td>

                      {/* Review Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubmission(sub);
                          }}
                          className={`btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 ${
                            sub.status === 'pending-verification'
                              ? 'border-primary/50 text-primary hover:bg-primary-50'
                              : ''
                          }`}
                        >
                          <Eye size={12} />
                          <span>{sub.status === 'pending-verification' ? 'Review Evidence' : 'View Claim'}</span>
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
    </div>
  );
}
