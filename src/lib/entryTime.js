export function taipeiDate(timestamp = Date.now()) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function entryTime({ date, time, now = Date.now() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('請填寫有效日期');
  if (date > taipeiDate(now)) throw new Error('不能預先記錄未來的資金或交易');
  if (date === taipeiDate(now) && !time) return now;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time || '')) throw new Error('補登紀錄請填寫實際發生時間（台灣時間）');
  const timestamp = Date.parse(`${date}T${time}+08:00`);
  if (!Number.isFinite(timestamp) || taipeiDate(timestamp) !== date || timestamp > now) {
    throw new Error('日期或時間無效，不能晚於現在');
  }
  return timestamp;
}

export function compareEntries(a, b) {
  return a.date.localeCompare(b.date)
    || Number(a.effectiveAt || a.createdAt || 0) - Number(b.effectiveAt || b.createdAt || 0)
    || String(a.id || '').localeCompare(String(b.id || ''));
}
