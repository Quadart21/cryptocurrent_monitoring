export type DashboardCurrencyOption = {
  code: string;
  name: string;
  groupId: number;
  groupName: string;
};
export type DashboardCityOption = { code: string; name: string };

export type DashboardCatalog = {
  onlineCurrencies: DashboardCurrencyOption[];
  cashModeCurrencies: DashboardCurrencyOption[];
  cities: DashboardCityOption[];
  defaultCity: string;
  defaultOnlineFrom: string;
  defaultOnlineTo: string;
  defaultCashFrom: string;
  defaultCashTo: string;
  /** Top online shortcuts by live demand (offer count), with fallbacks. */
  popularOnlinePairs: [string, string][];
  /** Top cash shortcuts by live demand, with fallbacks. */
  popularCashPairs: [string, string][];
};
