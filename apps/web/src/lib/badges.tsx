export const PaymentStatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === 'paid'
      ? 'badge badge--paid'
      : status === 'partial'
        ? 'badge badge--partial'
        : 'badge badge--unpaid';
  return <span className={cls}>{status}</span>;
};

export const BalanceBadge = ({
  amount,
  tone = 'neutral',
}: {
  amount: number;
  tone?: 'owed' | 'credit' | 'receivable' | 'neutral';
}) => {
  const cls =
    tone === 'credit'
      ? 'balance-badge balance-badge--credit'
      : tone === 'owed'
        ? 'balance-badge balance-badge--owed'
        : tone === 'receivable'
          ? 'balance-badge balance-badge--receivable'
          : 'balance-badge';
  return <span className={cls}>{amount.toLocaleString('en-KE')}</span>;
};
