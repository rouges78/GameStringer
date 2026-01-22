'use client';

import { ProjectManagerUI } from '@/components/tools/project-manager-ui';
import { useTranslation } from '@/lib/i18n';

export default function ProjectsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <ProjectManagerUI />
    </div>
  );
}



