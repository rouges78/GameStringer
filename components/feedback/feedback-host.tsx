'use client';

import { useEffect, useState } from 'react';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { subscribeFeedback, type FeedbackSource } from '@/lib/feedback-bus';

/**
 * Host globale del dialog di feedback: montato una sola volta nel layout,
 * ascolta `openFeedback()` dal bus e apre il form da qualunque punto dell'app
 * (voce di sidebar, pagina /feedback, invito a fine traduzione).
 */
export function FeedbackHost() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<FeedbackSource>('other');

  useEffect(() => {
    return subscribeFeedback((s) => {
      setSource(s);
      setOpen(true);
    });
  }, []);

  return <FeedbackDialog open={open} onOpenChange={setOpen} source={source} />;
}
