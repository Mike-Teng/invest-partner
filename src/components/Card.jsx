export default function Card({ children, className = "" }) {
  return <section className={`card-base ${className}`}>{children}</section>;
}
