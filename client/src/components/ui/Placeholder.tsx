import { Card } from '../../components/ui/Card';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex flex-col gap-6 page-content">
      <div>
        <h2 className="text-xl font-bold text-[#1A1714]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[#78716C]">{description}</p>}
      </div>
      <Card className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#FFF7ED] flex items-center justify-center mx-auto mb-3">
            <span className="text-[#EA580C] text-xl">🚧</span>
          </div>
          <p className="text-sm font-medium text-[#1A1714]">Under construction</p>
          <p className="text-xs text-[#78716C] mt-1">This page will be implemented next.</p>
        </div>
      </Card>
    </div>
  );
}
