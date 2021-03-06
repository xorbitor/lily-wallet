import React, { useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import {
  HashRouter as Router,
  Switch,
  Route,
  useLocation,
  useHistory
} from "react-router-dom";
import axios from 'axios';
import BigNumber from 'bignumber.js';
import moment from 'moment';
import { networks } from 'bitcoinjs-lib';

import { offWhite } from './utils/colors';
import { mobile } from './utils/media';
import { getDataFromMultisig, getDataFromXPub, getUnchainedNetworkFromBjslibNetwork } from './utils/transactions';

import { Sidebar, MobileNavbar, ErrorBoundary } from './components';

// Pages
import Login from './pages/Login';
import GDriveImport from './pages/GDriveImport';
import Setup from './pages/Setup';
import Settings from './pages/Settings';
import Vault from './pages/Vault';
import Receive from './pages/Receive';
import Send from './pages/Send';
import ColdcardImportInstructions from './pages/ColdcardImportInstructions';
import Home from './pages/Home';

const emptyConfig = {
  name: "",
  version: "0.0.1",
  isEmpty: true,
  backup_options: {
    gDrive: false
  },
  wallets: [],
  vaults: [],
  keys: []
}

function App() {
  const [currentBitcoinPrice, setCurrentBitcoinPrice] = useState(BigNumber(0));
  const [historicalBitcoinPrice, setHistoricalBitcoinPrice] = useState({});
  const [bitcoinQuote, setBitcoinQuote] = useState({
    body: 'There is no answer in the available literature to the question why a government monopoly of the provision of money is universally regarded as indispensable. ... It has the defects of all monopolies.',
    author: {
      name: 'F.A. Hayek',
      twitter: 'https://nakamotoinstitute.org/static/docs/denationalisation.pdf'
    }
  });
  // const [config, setConfigFile] = useState(configFixture);
  // const [currentAccount, setCurrentAccount] = useState({ config: config.vaults[0] });
  const [config, setConfigFile] = useState(emptyConfig);
  const [currentAccount, setCurrentAccount] = useState({ name: 'Loading...' });
  const [accountMap, setAccountMap] = useState(new Map());
  const [currentBitcoinNetwork, setCurrentBitcoinNetwork] = useState(networks.bitcoin);
  const [formattedPricesForChart, setFormattedPricesForChart] = useState([]);
  const [refresh, setRefresh] = useState(false);

  // WALLET DATA
  const [transactions, setTransactions] = useState([]);
  const [unusedAddresses, setUnusedAddresses] = useState([]);
  const [unusedChangeAddresses, setUnusedChangeAddresses] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(BigNumber(0));
  const [availableUtxos, setAvailableUtxos] = useState([]);
  const [loadingDataFromBlockstream, setLoadingDataFromBlockstream] = useState(false);

  const ConfigRequired = () => {
    const { pathname } = useLocation();
    const history = useHistory();
    if (config.isEmpty && (pathname !== '/login' && pathname !== '/gdrive-import' && pathname !== '/setup')) {
      history.push('/login');
      window.location.reload();
    }
    return null;
  }

  const toggleRefresh = () => {
    setRefresh(!refresh)
  }

  const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
      window.scrollTo(0, 0);
    }, [pathname]);
    return null;
  }

  const setCurrentAccountFromMap = (vault) => {
    const newVault = accountMap.get(vault.id);
    setCurrentAccount(newVault);
  }

  const changeCurrentBitcoinNetwork = () => {
    if (currentBitcoinNetwork === networks.bitcoin) {
      setCurrentBitcoinNetwork(networks.testnet);
    } else {
      setCurrentBitcoinNetwork(networks.bitcoin)
    }
  }

  useEffect(() => {
    async function fetchCurrentBitcoinPrice() {
      const currentBitcoinPrice = await (await axios.get('https://api.coindesk.com/v1/bpi/currentprice.json')).data.bpi.USD.rate;
      setCurrentBitcoinPrice(new BigNumber(currentBitcoinPrice.replace(',', '')));
    }
    fetchCurrentBitcoinPrice();
  }, []);

  useEffect(() => {
    async function fetchHistoricalBitcoinPrice() {
      const historicalBitcoinPrice = await (await axios.get(`https://api.coindesk.com/v1/bpi/historical/close.json?start=2014-01-01&end=${moment().format('YYYY-MM-DD')}`)).data;
      setHistoricalBitcoinPrice(historicalBitcoinPrice.bpi);
    }
    fetchHistoricalBitcoinPrice();
  }, []);

  useEffect(() => {
    async function fetchBitcoinQuote() {
      const bitcoinQuote = await (await axios.get('https://www.bitcoin-quotes.com/quotes/random.json')).data;
      setBitcoinQuote(bitcoinQuote);
    }
    fetchBitcoinQuote();
  }, []);

  useEffect(() => {
    if (config) {
      setLoadingDataFromBlockstream(true);
      async function fetchTransactionsFromBlockstream() {

        const accountMap = new Map();

        for (let i = 0; i < config.vaults.length; i++) {
          if (config.vaults[i].network === getUnchainedNetworkFromBjslibNetwork(currentBitcoinNetwork)) {
            const [addresses, changeAddresses, transactions, unusedAddresses, unusedChangeAddresses, availableUtxos] = await getDataFromMultisig(config.vaults[i], currentBitcoinNetwork);

            const currentBalance = availableUtxos.reduce((accum, utxo) => accum.plus(utxo.value), BigNumber(0));

            const vaultData = {
              name: config.vaults[i].name,
              config: config.vaults[i],
              addresses,
              changeAddresses,
              availableUtxos,
              transactions,
              unusedAddresses,
              currentBalance,
              unusedChangeAddresses
            };

            accountMap.set(config.vaults[i].id, vaultData);
          }
        }

        for (let i = 0; i < config.wallets.length; i++) {
          const [addresses, changeAddresses, transactions, unusedAddresses, unusedChangeAddresses, availableUtxos] = await getDataFromXPub(config.wallets[i], currentBitcoinNetwork);

          const currentBalance = availableUtxos.reduce((accum, utxo) => accum.plus(utxo.value), BigNumber(0));

          const vaultData = {
            name: config.wallets[i].name,
            config: config.wallets[i],
            addresses,
            changeAddresses,
            availableUtxos,
            transactions,
            unusedAddresses,
            currentBalance,
            unusedChangeAddresses
          };

          accountMap.set(config.wallets[i].id, vaultData);
        }

        setLoadingDataFromBlockstream(false);
        setAccountMap(accountMap);
        setCurrentAccount(accountMap.values().next().value);
      }
      try {
        fetchTransactionsFromBlockstream();
      } catch (e) {
        setLoadingDataFromBlockstream(false);
      }
    }
  }, [config, currentBitcoinNetwork, refresh]);

  useEffect(() => {
    if (currentAccount && accountMap.size) {
      setLoadingDataFromBlockstream(true);
      async function fetchTransactionsFromBlockstream() {
        const newVault = accountMap.get(currentAccount.config.id);

        setAvailableUtxos(newVault.availableUtxos);
        setUnusedAddresses(newVault.unusedAddresses);
        setTransactions(newVault.transactions);
        setCurrentBalance(newVault.currentBalance);
        setUnusedChangeAddresses(newVault.unusedChangeAddresses);
        setLoadingDataFromBlockstream(false);
      }
      fetchTransactionsFromBlockstream();
    }
  }, [currentAccount, config, currentBitcoinNetwork, accountMap]);

  useEffect(() => {
    let priceForChart = [];
    for (let i = 0; i < Object.keys(historicalBitcoinPrice).length; i++) {
      priceForChart.push({
        price: Object.values(historicalBitcoinPrice)[i],
        date: Object.keys(historicalBitcoinPrice)[i]
      })
    }
    setFormattedPricesForChart(priceForChart);
  }, [historicalBitcoinPrice]) // eslint-disable-line

  return (
    <ErrorBoundary>
      <Router>
        <PageWrapper id="page-wrapper" loading={loadingDataFromBlockstream}>
          <ScrollToTop />
          <ConfigRequired />
          {!config.isEmpty && <Sidebar config={config} setCurrentAccount={setCurrentAccountFromMap} loading={loadingDataFromBlockstream} />}
          {!config.isEmpty && <MobileNavbar config={config} setCurrentAccount={setCurrentAccountFromMap} loading={loadingDataFromBlockstream} />}
          <Switch>
            <Route path="/vault/:id" component={() => <Vault config={config} setConfigFile={setConfigFile} toggleRefresh={toggleRefresh} currentAccount={currentAccount} currentBitcoinNetwork={currentBitcoinNetwork} currentBitcoinPrice={currentBitcoinPrice} transactions={transactions} currentBalance={currentBalance} loadingDataFromBlockstream={loadingDataFromBlockstream} />} />
            <Route path="/receive" component={() => <Receive config={config} currentAccount={currentAccount} setCurrentAccount={setCurrentAccountFromMap} currentBitcoinPrice={currentBitcoinPrice} transactions={transactions} currentBalance={currentBalance} loadingDataFromBlockstream={loadingDataFromBlockstream} unusedAddresses={unusedAddresses} />} />
            <Route path="/send" component={() => <Send config={config} currentAccount={currentAccount} setCurrentAccount={setCurrentAccountFromMap} currentBitcoinPrice={currentBitcoinPrice} transactions={transactions} currentBalance={currentBalance} loadingDataFromBlockstream={loadingDataFromBlockstream} availableUtxos={availableUtxos} unusedChangeAddresses={unusedChangeAddresses} currentBitcoinNetwork={currentBitcoinNetwork} />} />
            <Route path="/setup" component={() => <Setup config={config} setConfigFile={setConfigFile} currentBitcoinNetwork={currentBitcoinNetwork} />} />
            <Route path="/login" component={() => <Login setConfigFile={setConfigFile} bitcoinQuote={bitcoinQuote} />} />
            <Route path="/settings" component={() => <Settings config={config} currentBitcoinNetwork={currentBitcoinNetwork} changeCurrentBitcoinNetwork={changeCurrentBitcoinNetwork} />} />
            <Route path="/gdrive-import" component={() => <GDriveImport setConfigFile={setConfigFile} bitcoinQuote={bitcoinQuote} />} />
            <Route path="/coldcard-import-instructions" component={() => <ColdcardImportInstructions />} />
            <Route path="/" component={() => <Home accountMap={accountMap} priceForChart={formattedPricesForChart} currentBitcoinPrice={currentBitcoinPrice} loading={loadingDataFromBlockstream} />} />
            <Route path="/" component={() => (
              <div>Not Found</div>
            )}
            />
          </Switch>
        </PageWrapper>
      </Router>
    </ErrorBoundary>
  );
}

const PageWrapper = styled.div`
  height: 100%;
  display: flex;
  font-family: 'Raleway', sans-serif;
  flex: 1;
  background: ${offWhite};
  cursor: ${p => p.loading ? 'wait' : 'auto'};
  pointer-events: ${p => p.loading ? 'none' : 'auto'};

  ${mobile(css`
    flex-direction: column;
  `)};
`;

export default App;
