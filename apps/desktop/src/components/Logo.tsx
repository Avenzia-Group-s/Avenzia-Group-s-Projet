export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Avenzia">
      <rect width="64" height="64" rx="18" fill="rgb(var(--accent))" />
      <path d="M32 14 46 50h-7l-3-8H28l-3 8h-7z M30 36h4l-2-6z" fill="#fff" fillRule="evenodd" />
    </svg>
  );
}
