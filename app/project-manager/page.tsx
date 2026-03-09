'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const ProjectManagerUI = dynamic(
  () => import('@/components/tools/project-manager-ui').then(m => m.ProjectManagerUI),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function ProjectManagerPage() {
  return <ProjectManagerUI />;
}
