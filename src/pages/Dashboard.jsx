import { Lock, ShieldAlert } from 'lucide-react';
import { calculatePerformance } from '../lib/accounting.js';
import { historicalPerformance } from '../lib/history.js';
import { formatPrice } from '../lib/formatters.js';
import PerformanceSummary from '../components/dashboard/PerformanceSummary.jsx';
import HistoryChart from '../components/dashboard/HistoryChart.jsx';
import AllocationSummary from '../components/dashboard/AllocationSummary.jsx';
import PartnerEquity from '../components/dashboard/PartnerEquity.jsx';
import AdminTools from '../components/dashboard/AdminTools.jsx';

export default function Dashboard(props) {
  const { user, isAdmin, isAllowed, investors, unitStats, portfolioStats, historyData, historyBasis,
    operationsReady, exchangeRate, secureMoney, adminEmail, investorMap, onNavigate } = props;
  const currentInvestorName = user ? investorMap[user.email] : null;
  const isSpecificInvestor = !isAdmin && currentInvestorName;
  const myData = isSpecificInvestor ? unitStats.investorData[currentInvestorName] : null;
  const display = calculatePerformance({
    assets: myData ? myData.units * unitStats.currentUnitPrice : unitStats.totalAssets,
    deposits: myData ? myData.deposits : unitStats.deposits,
    withdrawals: myData ? myData.withdrawals : unitStats.withdrawals,
  });
  const chartData = historyData.map(history => {
    const point = historicalPerformance(history, historyBasis.funds, historyBasis.operations, currentInvestorName);
    return !operationsReady && !point.frozenCashFlows ? { ...point, totalProfit: null, meProfit: null } : point;
  });
  return <div className="dashboard-layout">
    {!user ? <div className="access-notice"><Lock size={18} />請登入以查看財務數據</div> : !isAllowed ? <div className="access-notice"><ShieldAlert size={18} /><span>您的帳號 ({user.email}) 未在授權名單中，請聯繫管理員 ({adminEmail})。</span></div> : null}
    <PerformanceSummary {...{ display, unitStats, isSpecificInvestor, isAllowed, secureMoney }} />
    {isAllowed && !operationsReady && <p className="text-sm text-amber-700">歷史異動紀錄尚未讀取完成，舊快照收益暫不顯示。若持續出現，請確認資料讀取權限。</p>}
    {isAllowed && <div className={isSpecificInvestor ? '' : 'chart-allocation-grid'}>
      <HistoryChart data={chartData} isSpecificInvestor={isSpecificInvestor} investor={currentInvestorName} />
      {!isSpecificInvestor && <AllocationSummary {...{ portfolioStats, onNavigate }} totalAssets={unitStats.totalAssets} />}
    </div>}
    <PartnerEquity {...{ investors, unitStats, currentInvestorName, isSpecificInvestor, isAllowed, secureMoney }} />
    {isAllowed && unitStats.hasUnallocatedAssets && <div role="alert" className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm">所有單位已結清，帳上仍有 {formatPrice(unitStats.totalAssets)} 未分配資產（可能包含四捨五入差額）。請先核對結清差額，再新增資金紀錄。</div>}
    <div className="dashboard-footnote"><p>累計收益 = 目前資產 + 累計提領 − 累計入金。收益率以累計入金為分母，未考慮投入時間。</p>{isAllowed && <span className="shrink-0">USD / TWD <strong>{exchangeRate}</strong></span>}</div>
    {isAdmin && <AdminTools {...props} />}
  </div>;
}
