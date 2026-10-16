import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Award,
  Trash2,
} from 'lucide-react';
import type { TrainingSubmission } from '@/types';
import { skillsList } from '@/data/mockData';
import { formatFileSize, isValidHttpUrl } from '@/utils';
import { useData } from '@/context/DataContext';

interface TrainingSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<TrainingSubmission>;
  existingSubmission?: TrainingSubmission;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export function TrainingSubmissionModal({
  isOpen,
  onClose,
  initialData,
  existingSubmission,
}: TrainingSubmissionModalProps) {
  const { employees, submitTrainingClaim, resubmitTrainingClaim } = useData();

  // Aisha Patel is the demo employee profile
  const currentEmployee = employees.find((e) => e.id === 'emp-001') ?? employees[0];

  const [courseName, setCourseName] = useState('');
  const [provider, setProvider] = useState('');
  const [skillId, setSkillId] = useState(skillsList[0]?.id ?? '');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [credentialId, setCredentialId] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [notes, setNotes] = useState('');

  // File state
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'link' | 'none'>('none');
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isResubmission = Boolean(existingSubmission);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      const source = existingSubmission ?? initialData;
      if (source) {
        setCourseName(source.courseName || '');
        setProvider(source.provider || '');
        setSkillId(source.skillId || skillsList[0]?.id || '');
        setCompletionDate(source.completionDate || new Date().toISOString().split('T')[0]);
        setCredentialId(source.credentialId || '');
        setVerificationUrl(source.verificationUrl || '');
        setNotes(source.notes || '');
        if (source.evidenceDataUrl) {
          setFileDataUrl(source.evidenceDataUrl);
          setFileName(source.evidenceFileName || 'certificate_evidence');
          setFileType(source.evidenceFileType || 'pdf');
          setFileSize(source.evidenceFileSize || 0);
        } else {
          setFileDataUrl('');
          setFileName('');
          setFileType('none');
          setFileSize(0);
        }
      } else {
        setCourseName('');
        setProvider('');
        setSkillId(skillsList[0]?.id || '');
        setCompletionDate(new Date().toISOString().split('T')[0]);
        setCredentialId('');
        setVerificationUrl('');
        setNotes('');
        setFileDataUrl('');
        setFileName('');
        setFileType('none');
        setFileSize(0);
      }
    }
  }, [isOpen, initialData, existingSubmission]);

  if (!isOpen) return null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const newErrors = { ...errors };
    delete newErrors.file;

    // Validate type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        file: 'Unsupported format. Allowed formats: PDF (.pdf), PNG (.png), JPEG (.jpg, .jpeg), WEBP (.webp).',
      }));
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        file: `File size exceeds 5 MB limit (Selected: ${formatFileSize(file.size)}). Please upload a smaller document.`,
      }));
      return;
    }

    const isPdf = file.type === 'application/pdf';
    const determinedType: 'pdf' | 'image' = isPdf ? 'pdf' : 'image';

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFileDataUrl(result);
      setFileName(file.name);
      setFileType(determinedType);
      setFileSize(file.size);
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.file;
        delete copy.evidence;
        return copy;
      });
    };
    reader.onerror = () => {
      setErrors((prev) => ({
        ...prev,
        file: 'Failed to read file. Please select a valid document.',
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveFile() {
    setFileDataUrl('');
    setFileName('');
    setFileType('none');
    setFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!courseName.trim()) {
      newErrors.courseName = 'Course name is required.';
    }

    if (!provider.trim()) {
      newErrors.provider = 'Training provider or issuing institution is required.';
    }

    if (!completionDate) {
      newErrors.completionDate = 'Completion date is required.';
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (completionDate > today) {
        newErrors.completionDate = 'Completion date cannot be in the future.';
      }
    }

    if (verificationUrl.trim() && !isValidHttpUrl(verificationUrl.trim())) {
      newErrors.verificationUrl = 'Please enter a valid HTTP or HTTPS verification URL (e.g. https://...).';
    }

    // Require either a certificate file OR a verification URL as verifiable evidence
    if (!fileDataUrl && !verificationUrl.trim()) {
      newErrors.evidence = 'Please provide verifiable evidence: upload a certificate file (PDF/Image) or enter a credential verification URL.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isResubmission && existingSubmission) {
        resubmitTrainingClaim(existingSubmission.id, {
          courseName: courseName.trim(),
          provider: provider.trim(),
          skillId,
          completionDate,
          credentialId: credentialId.trim() || undefined,
          verificationUrl: verificationUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          evidenceFileName: fileName || existingSubmission.evidenceFileName,
          evidenceFileType: fileType !== 'none' ? fileType : existingSubmission.evidenceFileType,
          evidenceDataUrl: fileDataUrl || existingSubmission.evidenceDataUrl,
          evidenceFileSize: fileSize || existingSubmission.evidenceFileSize,
        });
      } else {
        submitTrainingClaim({
          employeeId: currentEmployee.id,
          employeeName: currentEmployee.name,
          employeeRole: currentEmployee.role,
          employeeDepartment: currentEmployee.department,
          employeeAvatarColor: currentEmployee.avatarColor,
          courseName: courseName.trim(),
          provider: provider.trim(),
          skillId,
          completionDate,
          credentialId: credentialId.trim() || undefined,
          verificationUrl: verificationUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          evidenceFileName: fileName || undefined,
          evidenceFileType: fileType,
          evidenceDataUrl: fileDataUrl || undefined,
          evidenceFileSize: fileSize || undefined,
          assignmentId: initialData?.assignmentId,
        });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-xl card bg-white border border-base-border shadow-modal rounded-xl my-6 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Award size={18} />
            </div>
            <div>
              <h2 id="modal-title" className="text-sm sm:text-base font-bold text-text-primary leading-tight">
                {isResubmission ? 'Resubmit Training Verification' : 'Submit Course Completion Claim'}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {isResubmission
                  ? 'Update your certificate evidence or credential details for review'
                  : 'Submit accredited evidence for Manager & HR verification'}
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

        {/* Resubmission feedback banner */}
        {isResubmission && existingSubmission && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-900">
                  {existingSubmission.status === 'rejected'
                    ? 'Previous submission was rejected:'
                    : 'Additional evidence requested by reviewer:'}
                </span>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  {existingSubmission.rejectionReason ||
                    existingSubmission.reviewerNotes ||
                    'Please attach an official verifiable certificate with completion date.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Submitter info reminder */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-bg border border-base-border text-xs">
            <span className="text-text-secondary">Submitting for:</span>
            <span className="font-semibold text-text-primary">
              {currentEmployee.name} ({currentEmployee.role})
            </span>
          </div>

          {/* Course Name */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Course Name <span className="text-critical">*</span>
            </label>
            <input
              type="text"
              className={`input-field w-full ${errors.courseName ? 'border-critical focus:ring-critical' : ''}`}
              placeholder="e.g. AWS Certified Solutions Architect, React Fundamentals"
              value={courseName}
              onChange={(e) => {
                setCourseName(e.target.value);
                if (errors.courseName) setErrors((prev) => ({ ...prev, courseName: '' }));
              }}
            />
            {errors.courseName && (
              <p className="text-[11px] text-critical mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.courseName}
              </p>
            )}
          </div>

          {/* Provider & Related Skill */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Training Provider <span className="text-critical">*</span>
              </label>
              <input
                type="text"
                className={`input-field w-full ${errors.provider ? 'border-critical focus:ring-critical' : ''}`}
                placeholder="e.g. Coursera, AWS, Linux Foundation"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  if (errors.provider) setErrors((prev) => ({ ...prev, provider: '' }));
                }}
              />
              {errors.provider && (
                <p className="text-[11px] text-critical mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.provider}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Associated Skill Competency <span className="text-critical">*</span>
              </label>
              <select
                className="input-field w-full"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
              >
                {skillsList.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name} ({skill.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Completion Date & Credential ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Completion Date <span className="text-critical">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className={`input-field w-full ${errors.completionDate ? 'border-critical focus:ring-critical' : ''}`}
                  value={completionDate}
                  onChange={(e) => {
                    setCompletionDate(e.target.value);
                    if (errors.completionDate) setErrors((prev) => ({ ...prev, completionDate: '' }));
                  }}
                />
              </div>
              {errors.completionDate && (
                <p className="text-[11px] text-critical mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.completionDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Credential / Certificate ID <span className="text-text-secondary font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="input-field w-full"
                placeholder="e.g. CERT-982103, HASHI-TA-991"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
              />
            </div>
          </div>

          {/* Certificate File Upload Section */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Certificate Document Upload <span className="text-text-secondary font-normal">(PDF or Image, max 5 MB)</span>
            </label>

            {fileDataUrl ? (
              <div className="p-3 rounded-lg border border-base-border bg-base-bg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {fileType === 'pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{fileName}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {formatFileSize(fileSize)} · {fileType.toUpperCase()} Evidence
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 text-text-secondary hover:text-critical rounded-lg hover:bg-critical/10 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-colors ${
                  errors.file || errors.evidence
                    ? 'border-critical/60 bg-red-50/40 hover:bg-red-50/70'
                    : 'border-base-border hover:border-primary/60 hover:bg-primary-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary flex items-center justify-center mx-auto mb-2">
                  <UploadCloud size={20} />
                </div>
                <p className="text-xs font-semibold text-text-primary">
                  Click to browse or drag and drop certificate
                </p>
                <p className="text-[11px] text-text-secondary mt-1">
                  Supported: PDF, PNG, JPG, WEBP (Up to 5 MB)
                </p>
              </div>
            )}

            {errors.file && (
              <p className="text-[11px] text-critical mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.file}
              </p>
            )}
          </div>

          {/* Credential Verification URL */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Credential Verification URL <span className="text-text-secondary font-normal">(optional or alternative evidence)</span>
            </label>
            <div className="relative">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="url"
                className={`input-field w-full pl-8 ${errors.verificationUrl ? 'border-critical focus:ring-critical' : ''}`}
                placeholder="https://www.credly.com/badges/... or https://verify.provider.com/..."
                value={verificationUrl}
                onChange={(e) => {
                  setVerificationUrl(e.target.value);
                  if (errors.verificationUrl) setErrors((prev) => ({ ...prev, verificationUrl: '' }));
                  if (errors.evidence) setErrors((prev) => ({ ...prev, evidence: '' }));
                }}
              />
            </div>
            {errors.verificationUrl && (
              <p className="text-[11px] text-critical mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.verificationUrl}
              </p>
            )}
          </div>

          {/* Overall Evidence Requirement Error */}
          {errors.evidence && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-critical flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errors.evidence}</span>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Submission Notes & Context <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="input-field w-full resize-none"
              placeholder="e.g. Scored 94% on proctored exam; completed capstone architectural deployment."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-base-border flex items-center justify-end gap-2.5 bg-base-subtle">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            <CheckCircle2 size={15} />
            {isResubmission ? 'Resubmit Verification' : 'Submit Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
