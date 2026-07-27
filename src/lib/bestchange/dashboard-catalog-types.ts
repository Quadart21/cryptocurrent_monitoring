export type DashboardCurrencyOption = { code: string; name: string };
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
};
