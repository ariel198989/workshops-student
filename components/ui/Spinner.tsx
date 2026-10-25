interface SpinnerProps {
  large?: boolean;
  label?: string;
}

export function Spinner({ large = false, label = 'טוען' }: SpinnerProps) {
  return <span className={large ? 'spinner lg' : 'spinner'} role="status" aria-label={label} />;
}
