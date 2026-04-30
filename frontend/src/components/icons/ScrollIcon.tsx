export function ScrollIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6" />
      <path d="M6 3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h0" />
      <line x1="10" y1="8" x2="16" y2="8" />
      <line x1="10" y1="12" x2="16" y2="12" />
      <line x1="10" y1="16" x2="14" y2="16" />
    </svg>
  );
}
