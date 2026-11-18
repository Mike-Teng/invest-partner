// --- 輔助函數 ---
export const safeNumber = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// 顯示總金額 (不帶小數，保持整潔)
export const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(safeNumber(amount));
};

// 新增：顯示單價/淨值/平均成本 (強制兩位小數)
export const formatPrice = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(amount));
};

export const formatOriginalMoney = (amount, isUS) => {
  return new Intl.NumberFormat(isUS ? 'en-US' : 'zh-TW', {
    style: 'currency',
    currency: isUS ? 'USD' : 'TWD',
    maximumFractionDigits: isUS ? 2 : 0
  }).format(safeNumber(amount));
};

export const formatUnit = (unit) => {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(safeNumber(unit));
};

export const formatPercent = (value) => {
  return `${(safeNumber(value) * 100).toFixed(2)}%`;
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

