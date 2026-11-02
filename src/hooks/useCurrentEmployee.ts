import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import type { Employee } from '@/types';

/**
 * Resolve the employee profile for employee-facing pages.
 * Profiles are resolved only from the authenticated database-linked employee record.
 */
export function useCurrentEmployee(): Employee | null {
  const { employees } = useData();
  const { user, identityStatus, mappedEmployee } = useAuth();

  return useMemo(() => {
    if (user) {
      if (
        identityStatus !== 'mapped' ||
        !mappedEmployee ||
        mappedEmployee.authUserId !== user.id
      ) {
        return null;
      }

      // Reuse the database-loaded employee row when available to keep references consistent.
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


    return null;
  }, [employees, user, identityStatus, mappedEmployee]);
}
