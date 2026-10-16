import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Calendar,
  Award,
  FileText,
  UserCheck,
  History,
  Clock,
  Download,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import type { TrainingSubmission } from '@/types';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { SkillTag } from '@/components/SkillTag';
import { formatDate, formatFileSize } from '@/utils';
import { useData } from '@/context/DataContext';

interface EvidenceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: TrainingSubmission | null;
  onResubmit?: (submission: TrainingSubmission) => void;
}

export function EvidenceReviewModal({
  isOpen,
  onClose,
  submission,
  onResubmit,
}: EvidenceReviewModalProps) {
  const { role, reviewTrainingClaim } = useData();

  const [activeTab, setActiveTab] = useState<'evidence' | 'history'>('evidence');
  const [decisionMode, setDecisionMode] = useState<'none' | 'approve' | 'reject' | 'evidence'>('none');
  const [reviewNote, setReviewNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageZoom, setImageZoom] = useState(false);

  // Default reviewer persona in Togetherly is Alex Morgan (Workforce Admin)
  // For demo self-approval testing: Alex Morgan has ID 'mgr-001'
  const currentManagerId = 'mgr-001';
  const currentManagerName = 'Alex Morgan';

  if (!isOpen || !submission) return null;

  // Self-approval restriction check:
  // If the reviewer ID matches the submission employee ID, or if viewing in employee mode:
  const isSelfSubmission = submission.employeeId === currentManagerId;
  const isManager = role === 'manager';

  function handleDecision(decision: 'approved' | 'rejected' | 'requested_more_evidence') {
    if (decision === 'rejected' && !reviewNote.trim()) {
      setNoteError('Please provide a mandatory reason explaining why this submission is rejected.');
      return;
    }

    if (decision === 'requested_more_evidence' && !reviewNote.trim()) {
      setNoteError('Please specify what additional documentation or evidence is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = reviewTrainingClaim(
        submission!.id,
        decision,
        reviewNote.trim() || (decision === 'approved' ? 'Verified against accreditation standards.' : ''),
        currentManagerId,
        currentManagerName
      );

      if (result.success) {
        setDecisionMode('none');
        setReviewNote('');
        setNoteError('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-3xl card bg-white border border-base-border shadow-modal rounded-xl my-6 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Award size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="review-modal-title" className="text-sm sm:text-base font-bold text-text-primary leading-tight">
                  {isManager ? 'Training Verification Review' : 'Training Completion Details'}
                </h2>
                <StatusBadge status={submission.status} />
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Claim ID: <span className="font-mono">{submission.id}</span> · Submitted {formatDate(submission.submissionDate)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-base-hover transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Submitter & Course Metadata Header */}
        <div className="px-5 py-3.5 bg-base-bg border-b border-base-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={submission.employeeName} color={submission.employeeAvatarColor || '#0078D4'} size="md" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-text-primary">{submission.employeeName}</h3>
              <p className="text-xs text-text-secondary">
                {submission.employeeRole} · {submission.employeeDepartment}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Related Competency:</span>
            <SkillTag skillId={submission.skillId} />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 border-b border-base-border flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'evidence'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Certificate & Evidence
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <History size={13} /> Audit Trail ({submission.auditTrail?.length || 1})
            </button>
          </div>

          {/* Quick Resubmit trigger for employee viewing rejected claim */}
          {!isManager && (submission.status === 'rejected' || submission.status === 'needs-more-evidence') && onResubmit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResubmit(submission);
              }}
              className="btn-primary text-xs py-1 px-2.5 mb-2"
            >
              Resubmit Evidence
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'evidence' ? (
            <>
              {/* Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-base-border bg-base-bg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Course Name</div>
                  <div className="mt-1 text-xs font-bold text-text-primary">{submission.courseName}</div>
                </div>

                <div className="p-3 rounded-xl border border-base-border bg-base-bg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Issuing Provider</div>
                  <div className="mt-1 text-xs font-bold text-text-primary">{submission.provider}</div>
                </div>

                <div className="p-3 rounded-xl border border-base-border bg-base-bg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Completion Date</div>
                  <div className="mt-1 text-xs font-bold text-text-primary flex items-center gap-1">
                    <Calendar size={13} className="text-primary" /> {formatDate(submission.completionDate)}
                  </div>
                </div>
              </div>

              {/* Credential ID and Verification URL */}
              {(submission.credentialId || submission.verificationUrl) && (
                <div className="p-3.5 rounded-xl border border-base-border bg-base-bg/60 space-y-2">
                  {submission.credentialId && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary font-medium">Credential / Certificate ID:</span>
                      <span className="font-mono font-bold text-text-primary bg-white px-2 py-0.5 rounded border border-base-border">
                        {submission.credentialId}
                      </span>
                    </div>
                  )}

                  {submission.verificationUrl && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-base-border/50 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-text-secondary font-medium">Online Credential Registry:</span>
                        <span className="font-mono text-primary truncate max-w-xs">{submission.verificationUrl}</span>
                      </div>
                      <a
                        href={submission.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                      >
                        Verify Credential Registry <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Employee Notes */}
              {submission.notes && (
                <div className="p-3 rounded-xl border border-base-border bg-base-subtle text-xs">
                  <span className="font-semibold text-text-primary">Employee Notes:</span>
                  <p className="mt-1 text-text-secondary leading-relaxed">{submission.notes}</p>
                </div>
              )}

              {/* Reviewer Feedback (if previously reviewed) */}
              {(submission.reviewerNotes || submission.rejectionReason) && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    submission.status === 'rejected'
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : submission.status === 'needs-more-evidence'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <UserCheck size={14} /> Reviewer Remarks ({submission.reviewerName || 'Reviewer'} on{' '}
                    {formatDate(submission.reviewTimestamp || '')}):
                  </div>
                  <p className="leading-relaxed">
                    {submission.rejectionReason || submission.reviewerNotes}
                  </p>
                </div>
              )}

              {/* Evidence Document Preview Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">Accredited Evidence Document</span>
                    {submission.evidenceFileName && (
                      <span className="text-[11px] text-text-secondary">({submission.evidenceFileName})</span>
                    )}
                  </div>
                  {submission.evidenceDataUrl && (
                    <a
                      href={submission.evidenceDataUrl}
                      download={submission.evidenceFileName || 'certificate_document'}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Download size={13} /> Download File
                    </a>
                  )}
                </div>

                {submission.evidenceDataUrl ? (
                  <div className="border border-base-border rounded-xl overflow-hidden bg-base-bg flex flex-col items-center justify-center">
                    {submission.evidenceFileType === 'pdf' ? (
                      <div className="w-full">
                        <div className="p-3 border-b border-base-border bg-white flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                            <FileText size={16} className="text-primary" />
                            <span>PDF Verification Document</span>
                            <span className="text-text-secondary font-normal font-mono">
                              ({formatFileSize(submission.evidenceFileSize)})
                            </span>
                          </div>
                          <a
                            href={submission.evidenceDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-[11px] py-1 px-2"
                          >
                            Open in New Tab <ExternalLink size={12} />
                          </a>
                        </div>
                        <div className="h-72 w-full bg-gray-100 flex items-center justify-center p-2">
                          <object
                            data={submission.evidenceDataUrl}
                            type="application/pdf"
                            className="w-full h-full rounded border border-base-border bg-white"
                          >
                            <div className="p-6 text-center text-xs text-text-secondary">
                              <p className="font-semibold text-text-primary mb-2">PDF Document Ready</p>
                              <p className="mb-4">Use the button below to view the official PDF certificate.</p>
                              <a
                                href={submission.evidenceDataUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary mx-auto"
                              >
                                View PDF Certificate <ExternalLink size={14} />
                              </a>
                            </div>
                          </object>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group w-full bg-gray-50 flex items-center justify-center p-3">
                        <img
                          src={submission.evidenceDataUrl}
                          alt="Certificate Evidence"
                          className={`max-h-80 w-auto object-contain rounded border border-base-border shadow-sm transition-all ${
                            imageZoom ? 'scale-125' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setImageZoom((v) => !v)}
                          className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-text-primary p-1.5 rounded-lg border border-base-border shadow-sm text-xs flex items-center gap-1 transition-colors"
                        >
                          <ZoomIn size={13} /> {imageZoom ? 'Reset Zoom' : 'Zoom Certificate'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-base-border rounded-xl p-8 text-center text-xs text-text-secondary bg-base-bg">
                    <p className="font-medium text-text-primary">No standalone certificate file uploaded.</p>
                    <p className="mt-1">
                      Verification was submitted via external credential registry link above.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Audit Trail Timeline */
            <div className="space-y-3">
              <div className="text-xs font-bold text-text-primary mb-2">Verification History & Audit Trail</div>
              {submission.auditTrail && submission.auditTrail.length > 0 ? (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-base-border">
                  {submission.auditTrail.map((log, idx) => (
                    <div key={log.id || idx} className="relative flex items-start gap-3 pl-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-white ${
                          log.action === 'approved'
                            ? 'bg-emerald-600'
                            : log.action === 'rejected'
                            ? 'bg-rose-600'
                            : log.action === 'requested_more_evidence'
                            ? 'bg-indigo-600'
                            : 'bg-primary'
                        }`}
                      >
                        {log.action === 'approved' ? (
                          <CheckCircle2 size={13} />
                        ) : log.action === 'rejected' ? (
                          <XCircle size={13} />
                        ) : log.action === 'requested_more_evidence' ? (
                          <HelpCircle size={13} />
                        ) : (
                          <Clock size={13} />
                        )}
                      </div>

                      <div className="flex-1 p-3 rounded-xl border border-base-border bg-base-bg text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-text-primary capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-text-secondary font-mono">
                            {new Date(log.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-secondary mt-0.5 font-medium">
                          Actor: {log.actorName} ({log.actorRole})
                        </div>
                        {log.note && (
                          <p className="mt-1.5 text-text-primary bg-white p-2 rounded border border-base-border/60 leading-relaxed">
                            {log.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">No recorded history entries.</p>
              )}
            </div>
          )}
        </div>

        {/* Manager Review Action Drawer / Panel */}
        {isManager && (
          <div className="p-4 border-t border-base-border bg-base-subtle">
            {isSelfSubmission ? (
              /* Self-Approval Restriction Banner */
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle size={17} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900">Self-Review Prohibited by Corporate Policy</h4>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    You cannot review or approve your own training completion claim. Another manager or HR
                    administrator must inspect and verify this submission.
                  </p>
                </div>
              </div>
            ) : decisionMode === 'none' ? (
              /* Decision Selection Controls */
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-text-secondary">
                  Reviewer: <span className="font-semibold text-text-primary">{currentManagerName}</span> (Workforce
                  Administrator)
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('evidence');
                      setReviewNote('');
                      setNoteError('');
                    }}
                    className="btn-secondary text-xs"
                  >
                    <HelpCircle size={14} className="text-indigo-600" /> Request Evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('reject');
                      setReviewNote('');
                      setNoteError('');
                    }}
                    className="btn-danger text-xs"
                  >
                    <XCircle size={14} /> Reject Claim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('approve');
                      setReviewNote('');
                      setNoteError('');
                    }}
                    className="btn-primary text-xs !bg-emerald-600 hover:!bg-emerald-700"
                  >
                    <CheckCircle2 size={14} /> Approve Verification
                  </button>
                </div>
              </div>
            ) : (
              /* Expanded Action Form */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    {decisionMode === 'approve' && (
                      <>
                        <CheckCircle2 size={15} className="text-emerald-600" /> Approve Training Verification
                      </>
                    )}
                    {decisionMode === 'reject' && (
                      <>
                        <XCircle size={15} className="text-rose-600" /> Reject Training Claim
                      </>
                    )}
                    {decisionMode === 'evidence' && (
                      <>
                        <HelpCircle size={15} className="text-indigo-600" /> Request Additional Evidence
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionMode('none');
                      setNoteError('');
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    Cancel Action
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    {decisionMode === 'approve'
                      ? 'Approval Remarks (Optional):'
                      : decisionMode === 'reject'
                      ? 'Mandatory Rejection Reason:'
                      : 'Required Information / Evidence Requested:'}
                    {(decisionMode === 'reject' || decisionMode === 'evidence') && (
                      <span className="text-critical ml-1">*</span>
                    )}
                  </label>
                  <textarea
                    rows={2}
                    className={`input-field w-full resize-none ${noteError ? 'border-critical focus:ring-critical' : ''}`}
                    placeholder={
                      decisionMode === 'approve'
                        ? 'e.g. Credential verified against official registry. Curriculum meets technical requirements.'
                        : decisionMode === 'reject'
                        ? 'e.g. Ineligible training course, expired credential, or does not meet enterprise curriculum requirements.'
                        : 'e.g. Please provide official completion certificate with accredited hours, or share the public verification URL.'
                    }
                    value={reviewNote}
                    onChange={(e) => {
                      setReviewNote(e.target.value);
                      if (noteError) setNoteError('');
                    }}
                  />
                  {noteError && <p className="text-[11px] text-critical mt-1">{noteError}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setDecisionMode('none')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  {decisionMode === 'approve' && (
                    <button
                      type="button"
                      className="btn-primary text-xs !bg-emerald-600 hover:!bg-emerald-700"
                      onClick={() => handleDecision('approved')}
                      disabled={isSubmitting}
                    >
                      <CheckCircle2 size={14} /> Confirm & Verify
                    </button>
                  )}
                  {decisionMode === 'reject' && (
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      onClick={() => handleDecision('rejected')}
                      disabled={isSubmitting}
                    >
                      <XCircle size={14} /> Confirm Rejection
                    </button>
                  )}
                  {decisionMode === 'evidence' && (
                    <button
                      type="button"
                      className="btn-primary text-xs !bg-indigo-600 hover:!bg-indigo-700"
                      onClick={() => handleDecision('requested_more_evidence')}
                      disabled={isSubmitting}
                    >
                      <HelpCircle size={14} /> Send Evidence Request
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
