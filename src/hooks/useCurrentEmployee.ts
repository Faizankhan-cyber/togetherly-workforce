import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { demoEmployeeId } from '@/data/mockData';
import type { Employee } from '@/types';

/**
 * Resolve the employee profile for employee-facing pages.
 * Authenticated users must use their database-linked employee record; only demo
 * sessions may fall back to the fixed demo profile.
 */
export function useCurrentEmployee(): Employee | null {
  const { employees } = useData();
  const { user, identityStatus, mappedEmployee, isDemoMode } = useAuth();

  return useMemo(() => {
    if (user) {
      if (
        identityStatus !== 'mapped' ||
        !mappedEmployee ||
        mappedEmployee.authUserId !== user.id
      ) {
        return null;
      }

      // Reuse the app's local record when available so locally stored skills,
      // training and project references remain connected to the same employee ID.
      const localRecord =
        employees.find((employee) => employee.authUserId === user.id) ??
        employees.find((employee) => employee.id === mappedEmployee.id);

      if (!localRecord) return mappedEmployee;

      return {
        ...localRecord,
        ...mappedEmployee,
        id: localRecord.id,
        authUserId: user.id,
        skills: localRecord.skills ?? mappedEmployee.skills,
        trainingAssignments: localRecord.trainingAssignments ?? mappedEmployee.trainingAssignments,
      };
    }

    // The demo profile is a fallback for unauthenticated demo mode only.
    if (isDemoMode) {
      return employees.find((employee) => employee.id === demoEmployeeId) ?? null;
    }

    return null;
  }, [employees, user, identityStatus, mappedEmployee, isDemoMode]);
}
