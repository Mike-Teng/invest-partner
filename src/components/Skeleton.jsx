export default function Skeleton({ className = "" }) {
  return <span aria-hidden="true" className={`shimmer rounded inline-block ${className}`} />;
}
