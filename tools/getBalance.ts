// Ad-hoc script to get balances from exchanges and output the result in CSV format.

import * as _ from 'lodash';
import { getConfigRoot, findBrokerConfig } from '../src/configUtil';
import BitflyerApi from '../src/Bitflyer/BrokerApi';
import CoincheckApi from '../src/Coincheck/BrokerApi';
import QuoineApi from '../src/Quoine/BrokerApi';

import { Balance } from '../src/Bitflyer/types';
import { AccountBalance } from '../src/Quoine/types';
import { options } from '@bitr/logger';
import { DateTime } from 'luxon';
import axios from 'axios';

options.enabled = false;

async function main() {
  const config = getConfigRoot();
  const bfConfig = findBrokerConfig(config, 'Bitflyer');
  const ccConfig = findBrokerConfig(config, 'Coincheck');
  const quConfig = findBrokerConfig(config, 'Quoine');
  const bitbankConfig = findBrokerConfig(config, 'Bitbankcc');
  const btcboxConfig = findBrokerConfig(config, 'Btcbox');

  const bitbankApibrokerModule = await tryImport('@bitr/bitbankcc')
  const brokerModule = await tryImport('@bitr/btcbox')

  const bfApi = new BitflyerApi(bfConfig.key, bfConfig.secret);
  const ccApi = new CoincheckApi(ccConfig.key, ccConfig.secret);
  const quApi = new QuoineApi(quConfig.key, quConfig.secret);
  const bitbankApi = bitbankApibrokerModule.create(bitbankConfig)
  const btcboxApi = brokerModule.create(btcboxConfig);

  const local = DateTime.local();
  const rezonedDate = local.setZone("Asia/Tokyo");

  // csv header
  process.stdout.write('Date, Exchange, Currency, Type, Amount\n');

  const btcBalances: number[] = []
  const jpyBalances: number[] = []

  // bitflyer cash balance
  if (bfConfig.enabled) {
    const bfBalance = await bfApi.getBalance();
    const bfJpy = (bfBalance.find(x => x.currency_code === 'JPY') as Balance).available;
    const bfBtc = (bfBalance.find(x => x.currency_code === 'BTC') as Balance).available;
    jpyBalances.push(bfJpy)
    btcBalances.push(bfBtc)
    printBalance(rezonedDate, 'bitFlyer', 'JPY', 'Cash', _.round(bfJpy));
    printBalance(rezonedDate, 'bitFlyer', 'BTC', 'Cash', bfBtc);
  }

  // coincheck cash balance
  if (ccConfig.enabled) {
    const ccBalance = await ccApi.getAccountsBalance();
    const ccJpy = _.round(ccBalance.jpy)
    const ccBtc = ccBalance.btc
    jpyBalances.push(ccJpy)
    btcBalances.push(ccBtc)
    printBalance(rezonedDate, 'Coincheck', 'JPY', 'Cash', ccJpy);
    printBalance(rezonedDate, 'Coincheck', 'BTC', 'Cash', ccBtc);

    // coincheck margin balance
    // const ccLeverageBalance = await ccApi.getLeverageBalance();
    // printBalance(rezonedDate, 'Coincheck', 'JPY', 'Margin', _.round(ccLeverageBalance.margin.jpy));
    // printBalance(rezonedDate, 'Coincheck', 'JPY', 'Free Margin', _.round(ccLeverageBalance.margin_available.jpy));
    // const positions = await ccApi.getAllOpenLeveragePositions();
    // const longPosition = _.sumBy(positions.filter(p => p.side === 'buy'), p => p.amount);
    // const shortPosition = _.sumBy(positions.filter(p => p.side === 'sell'), p => p.amount);
    // printBalance(rezonedDate, 'Coincheck', 'BTC', 'Leverage Position', longPosition - shortPosition);
  }

  if (quConfig.enabled) {
    // quoine cash balance
    const quCashBalance = await quApi.getAccountBalance();
    const quJpyCash = quCashBalance.find(b => b.currency === 'JPY') as AccountBalance;
    const quBtcCash = quCashBalance.find(b => b.currency === 'BTC') as AccountBalance;
    const quJpy = _.round(quJpyCash.balance)
    const quBtc = quBtcCash.balance
    jpyBalances.push(quJpy)
    btcBalances.push(quBtc)
    printBalance(rezonedDate, 'Quoine', 'JPY', 'Cash', quJpy);
    printBalance(rezonedDate, 'Quoine', 'BTC', 'Cash', quBtc);

    // // quoine margin balance
    // const quBalance = await quApi.getTradingAccounts();
    // const quBtcJpyBalance = quBalance.find(x => x.currency_pair_code === 'BTCJPY') as TradingAccount;
    // printBalance(rezonedDate, 'Quoine', 'JPY', 'Margin', _.round(quBtcJpyBalance.balance));
    // printBalance(rezonedDate, 'Quoine', 'JPY', 'Free Margin', _.round(quBtcJpyBalance.free_margin));
    // printBalance(rezonedDate, 'Quoine', 'BTC', 'Leverage Position', quBtcJpyBalance.position);
  }

  // bitbank cash balance
  if (bitbankConfig.enabled) {
    // bitbank cash balance
    const bitbankCashBalance = await bitbankApi.getPositions();

    const bitbankJpyCash = bitbankCashBalance.get("JPY");
    const bitbankBtcCash = bitbankCashBalance.get("BTC");
    const bitbankJpy = _.round(bitbankJpyCash)
    const bitbankBtc = bitbankBtcCash
    jpyBalances.push(bitbankJpy)
    btcBalances.push(bitbankBtc)
    printBalance(rezonedDate, 'bitbank', 'JPY', 'Cash', bitbankJpy);
    printBalance(rezonedDate, 'bitbank', 'BTC', 'Cash', bitbankBtc);
  }

  // btcbox cash balance
  if (btcboxConfig.enabled) {
    // btcbox cash balance
    const btcboxCashBalance = await btcboxApi.getPositions();

    const btcboxJpyCash = btcboxCashBalance.get("JPY");
    const btcboxBtcCash = btcboxCashBalance.get("BTC");
    const btcboxJpy = _.round(btcboxJpyCash)
    const btcboxBtc = btcboxBtcCash
    jpyBalances.push(btcboxJpy)
    btcBalances.push(btcboxBtc)
    printBalance(rezonedDate, 'btcbox', 'JPY', 'Cash', btcboxJpy);
    printBalance(rezonedDate, 'btcbox', 'BTC', 'Cash', btcboxBtc);
  }

  const jpySummary = sum(jpyBalances)
  const btcSummary = sum(btcBalances)
  printBalance(rezonedDate, 'summary', 'JPY', 'Cash', jpySummary);
  printBalance(rezonedDate, 'summary', 'BTC', 'Cash', btcSummary);

  const latestPrice = await getLatestPrice()
  const summary = btcSummary * latestPrice + jpySummary
  printBalance(rezonedDate, 'summary', 'SUM', 'Cash', summary);
}

function printBalance(dateTime: DateTime, Exchange: string, Currency: string, Type: string, Amount: number) {
  const dateString = dateTime.toFormat('yyyy-MM-dd HH:mm:ss');

  process.stdout.write(`${dateString}, ${Exchange}, ${Currency}, ${Type}, ${Amount}\n`);
}

async function tryImport(path: string): Promise<any> {
  try {
    const module = await import(path);
    if (module.create === undefined) {
      return undefined;
    }
    return module;
  } catch (ex) {
    return undefined;
  }
}

function sum(arr: number[]) {
  var sum = 0;
  arr.forEach(function (elm) {
    sum += elm;
  });
  return sum;
};

async function getLatestPrice(): Promise<number> {
  const res = await axios.get('https://public.bitbank.cc/btc_jpy/ticker')

  return res.data.data.last
}

main();
