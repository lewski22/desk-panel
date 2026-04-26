export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <span>⚠</span> {error}
    </p>
  );
}
