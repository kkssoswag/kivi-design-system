import { useEffect } from 'react';
import { toast } from '@kivi';
import { INITIAL_BALANCE, db } from '../data/db';

/*
  余额低于初始的 20%：每天第一次打开 Toast 提示（照线上 BalanceInfo：低于 20% 提示、每天一次、存 localStorage）。
  文案原文照线上 locales「用量温馨提示」。
*/

const KEY = 'kivi-app-balance-tip-date';
const TEXT = '温馨提示：今日使用数量已超过配额的80%';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 在 App 根上调一次 */
export function useBalanceTip() {
  useEffect(() => {
    if (db.get().balance / INITIAL_BALANCE >= 0.2) return;
    const date = today();
    try {
      if (localStorage.getItem(KEY) === date) return;
      localStorage.setItem(KEY, date);
    } catch {
      /* 存不了就每次都提示一次，不影响使用 */
    }
    toast.warning(TEXT);
  }, []);
}
