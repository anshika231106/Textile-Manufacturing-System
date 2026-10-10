import { Card } from '../../components/ui/Card';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex flex-col gap-6 page-content">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-(--color-text)">{title}</h2>
        {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
      </div>
      <Card className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-(--color-accent-light) flex items-center justify-center mx-auto mb-3">
            <span className="text-(--color-accent) text-xl">🚧</span>
          </div>
          <p className="text-sm font-medium text-(--color-text)">Under construction</p>
          <p className="text-xs text-(--color-text-muted) mt-1">This page will be implemented next.</p>
        </div>
      </Card>
    </div>
  );
}
