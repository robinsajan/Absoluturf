export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
export const matchDate = (date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', options);
export const matchTime = (time: string) => new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
