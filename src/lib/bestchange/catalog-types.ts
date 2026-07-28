export type BcCurrency = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  viewname: string;
  urlname?: string;
  crypto: boolean;
  cash: boolean;
  groupId: number;
  ps?: number;
  defamt?: number;
  bigamt?: number;
  rank: number;
};

export type BcCity = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  countryId?: number;
  countryCode: string;
  countryName: string;
  rank: number;
};

export type BcCountry = {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  rank: number;
};

export type BcGroup = {
  id: number;
  name: string;
  nameEn: string;
};
