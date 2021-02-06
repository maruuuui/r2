// Ad-hoc script to get balances from exchanges and output the result in CSV format.

import * as _ from 'lodash';
import { getConfigRoot, findBrokerConfig } from '../src/configUtil';
import BitflyerApi from '../src/Bitflyer/BrokerApi';
import CoincheckApi from '../src/Coincheck/BrokerApi';
import QuoineApi from '../src/Quoine/BrokerApi';

import { Balance } from '../src/Bitflyer/types';
import { TradingAccount, AccountBalance } from '../src/Quoine/types';
import { options } from '@bitr/logger';
import { DateTime } from 'luxon';

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

  // bitflyer cash balance
  if (bfConfig.enabled) {
    const bfBalance = await bfApi.getBalance();
    const bfJpy = (bfBalance.find(x => x.currency_code === 'JPY') as Balance).available;
    const bfBtc = (bfBalance.find(x => x.currency_code === 'BTC') as Balance).available;
    printBalance(rezonedDate, 'bitFlyer', 'JPY', 'Cash', _.round(bfJpy));
    printBalance(rezonedDate, 'bitFlyer', 'BTC', 'Cash', bfBtc);
  }

  // coincheck cash balance
  if (ccConfig.enabled) {
    const ccBalance = await ccApi.getAccountsBalance();
    printBalance(rezonedDate, 'Coincheck', 'JPY', 'Cash', _.round(ccBalance.jpy));
    printBalance(rezonedDate, 'Coincheck', 'BTC', 'Cash', ccBalance.btc);

    // coincheck margin balance
    const ccLeverageBalance = await ccApi.getLeverageBalance();
    printBalance(rezonedDate, 'Coincheck', 'JPY', 'Margin', _.round(ccLeverageBalance.margin.jpy));
    printBalance(rezonedDate, 'Coincheck', 'JPY', 'Free Margin', _.round(ccLeverageBalance.margin_available.jpy));
    const positions = await ccApi.getAllOpenLeveragePositions();
    const longPosition = _.sumBy(positions.filter(p => p.side === 'buy'), p => p.amount);
    const shortPosition = _.sumBy(positions.filter(p => p.side === 'sell'), p => p.amount);
    printBalance(rezonedDate, 'Coincheck', 'BTC', 'Leverage Position', longPosition - shortPosition);
  }

  if (quConfig.enabled) {
    // quoine cash balance
    const quCashBalance = await quApi.getAccountBalance();
    const quJpyCash = quCashBalance.find(b => b.currency === 'JPY') as AccountBalance;
    const quBtcCash = quCashBalance.find(b => b.currency === 'BTC') as AccountBalance;
    printBalance(rezonedDate, 'Quoine', 'JPY', 'Cash', _.round(quJpyCash.balance));
    printBalance(rezonedDate, 'Quoine', 'BTC', 'Cash', quBtcCash.balance);

    // quoine margin balance
    const quBalance = await quApi.getTradingAccounts();
    const quBtcJpyBalance = quBalance.find(x => x.currency_pair_code === 'BTCJPY') as TradingAccount;
    printBalance(rezonedDate, 'Quoine', 'JPY', 'Margin', _.round(quBtcJpyBalance.balance));
    printBalance(rezonedDate, 'Quoine', 'JPY', 'Free Margin', _.round(quBtcJpyBalance.free_margin));
    printBalance(rezonedDate, 'Quoine', 'BTC', 'Leverage Position', quBtcJpyBalance.position);
  }

  // bitbank cash balance
  if (bitbankConfig.enabled) {
    // bitbank cash balance
    const bitbankCashBalance = await bitbankApi.getPositions();

    const bitbankJpyCash = bitbankCashBalance.get("JPY");
    const bitbankBtcCash = bitbankCashBalance.get("BTC");
    printBalance(rezonedDate, 'bitbank', 'JPY', 'Cash', _.round(bitbankJpyCash));
    printBalance(rezonedDate, 'bitbank', 'BTC', 'Cash', bitbankBtcCash);
  }

  // btcbox cash balance
  if (btcboxConfig.enabled) {
    // btcbox cash balance
    const btcboxCashBalance = await btcboxApi.getPositions();

    const btcboxJpyCash = btcboxCashBalance.get("JPY");
    const btcboxBtcCash = btcboxCashBalance.get("BTC");
    printBalance(rezonedDate, 'btcbox', 'JPY', 'Cash', _.round(btcboxJpyCash));
    printBalance(rezonedDate, 'btcbox', 'BTC', 'Cash', btcboxBtcCash);
  }
}

function printBalance(dateTime: DateTime, Exchange: string, Currency: string, Type: string, Amount: number) {
  const dateString = dateTime.toLocaleString(DateTime.DATETIME_FULL)

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

main();
