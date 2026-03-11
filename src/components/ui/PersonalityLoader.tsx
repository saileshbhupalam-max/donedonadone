import { getLoadingMessage } from '@/lib/personality';

export function PersonalityLoader() {
  const message = getLoadingMessage();
  return (
    <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">
      {message}
    </p>
  );
}
