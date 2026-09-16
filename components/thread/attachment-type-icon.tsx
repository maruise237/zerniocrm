import { FileText, ImageIcon, Mic, Play } from 'lucide-react';

import type { Attachment } from '@/lib/types';

const DEFAULT_CLASS = 'size-3.5 shrink-0';

export function AttachmentTypeIcon({
  type,
  className = DEFAULT_CLASS,
}: {
  type: Attachment['type'];
  className?: string;
}) {
  if (type === 'audio') return <Mic className={className} aria-hidden="true" />;
  if (type === 'image') return <ImageIcon className={className} aria-hidden="true" />;
  if (type === 'video') return <Play className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}
