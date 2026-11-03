const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatMoney = (n) => money.format(Number(n) || 0);

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export const percentOff = (price, compareAt) => (compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0);

const STATUS_LABELS = {
  awaiting_payment: 'Awaiting payment',
  processing: 'Processing',
  ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  refunded: 'Refunded',
};
export const statusLabel = (s) => STATUS_LABELS[s] || s;
