const pad = (value: number) => String(value).padStart(2, '0');

export const formatISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const todayISO = (): string => formatISODate(new Date());

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return next;
};

export const startOfWeek = (date: Date): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = next.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + offset);
  return next;
};

export const endOfWeek = (date: Date): Date => addDays(startOfWeek(date), 6);

export const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const endOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

export const formatRuDate = (date: Date): string =>
  date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatRuRange = (from: Date, to: Date): string => {
  const sameYear = from.getFullYear() === to.getFullYear();
  const left = from.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${left} – ${formatRuDate(to)}`;
};
