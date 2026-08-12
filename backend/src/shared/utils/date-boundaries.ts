export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  // Monday is start of week:
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export function endOfWeek(): Date {
  const d = startOfWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfNextWeek(): Date {
  const d = startOfWeek();
  d.setDate(d.getDate() + 7);
  return d;
}

export function endOfNextWeek(): Date {
  const d = startOfNextWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
