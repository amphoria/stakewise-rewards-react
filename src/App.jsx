import React, { useState, useEffect, Fragment } from 'react';
import 'normalize.css';
import './style.css';
import { StakeWiseSDK, Network } from '@stakewise/v3-sdk';
import * as XLSX from 'xlsx';

export default function App() {

  // Constants
  const genesisVaultAddress = '0xAC0F906E433d58FA868F936E8A43230473652885';

  // State
  const [vaults, setVaults] = useState([]);
  const [network, setNetwork] = useState('Ethereum');
  const [vaultOptions, setVaultOptions] = useState([]);
  const [selectedVaultOption, setSelectedVaultOption] = useState('');
  const [formVaultName, setFormVaultName] = useState('');
  const [formVaultAddress, setFormVaultAddress] = useState('');
  const [addDisabled, setAddDisabled] = useState(true);
  const [deleteDisabled, setDeleteDisabled] = useState(true);
  const [userAddress, setUserAddress] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [rewards, setRewards] = useState([]);
  const [exportData, setExportData] = useState([]);
  const [sdk, setSdk] = useState(null);

  // Helpers for cookies
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  };

  const writeCookie = (name, val) => {
    document.cookie = `${name}=${val}; path=/`;
  };

  // Initial setup on mount
  useEffect(() => {
    // Load vaults from cookie or use default
    const cookie = getCookie('stakewiseVaults');
    let initialVaults = [];
    if (cookie && cookie !== '[]') {
      try { initialVaults = JSON.parse(cookie); }
      catch { initialVaults = []; }
    }
    if (!initialVaults.length) {
      initialVaults = [{ network: 'Ethereum', name: 'Genesis', address: genesisVaultAddress }];
      writeCookie('stakewiseVaults', JSON.stringify(initialVaults));
    }
    setVaults(initialVaults);

    // Load user address and date from cookies
    const ua = getCookie('defaultUserAddress');
    if (ua) setUserAddress(ua);
    const fd = getCookie('defaultFromDate');
    setFromDate(fd || '2023-11-29');
  }, []);

  // Update SDK, options, form fields when vaults or network change
  useEffect(() => {
    // Instantiate SDK for selected network
    const endpoints = {
      web3: network === 'Ethereum'
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : `https://gnosis-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    };
    const sdkInstance = new StakeWiseSDK({ network: network === 'Ethereum' ? Network.Mainnet : Network.Gnosis, endpoints });
    setSdk(sdkInstance);

    // Build vault selector options
    const opts = vaults
      .filter(v => v.network === network)
      .map(v => `${v.name}: ${v.address}`);
    setVaultOptions(opts);

    // Select first option by default
    if (opts.length) {
      setSelectedVaultOption(opts[0]);
      const [n, a] = opts[0].split(': ');
      setFormVaultName(n);
      setFormVaultAddress(a);
      setDeleteDisabled(opts.length <= 1);
    }

    // Clear rewards on network/vault change
    setRewards([]);
    setExportData([]);
    setAddDisabled(true);
  }, [vaults, network]);

  // Handlers
  const handleAddVault = () => {
    const newVault = { network, name: formVaultName, address: formVaultAddress };
    const updated = [...vaults, newVault];
    setVaults(updated);
    writeCookie('stakewiseVaults', JSON.stringify(updated));
    setAddDisabled(true);
  };

  const handleDeleteVault = () => {
    const idx = vaults.findIndex(v => v.network === network && v.name === formVaultName && v.address === formVaultAddress);
    if (idx >= 0) {
      const updated = [...vaults];
      updated.splice(idx, 1);
      setVaults(updated);
      writeCookie('stakewiseVaults', JSON.stringify(updated));
    }
  };

  const handleVaultOptionChange = (e) => {
    const val = e.target.value;
    setSelectedVaultOption(val);
    const [n, a] = val.split(': ');
    setFormVaultName(n);
    setFormVaultAddress(a);
    setDeleteDisabled(vaultOptions.length <= 1);
    setRewards([]);
  };

  const saveUserAddress = () => {
    if (userAddress) writeCookie('defaultUserAddress', userAddress);
  };
  const saveFromDate = () => {
    if (fromDate) writeCookie('defaultFromDate', fromDate);
  };

  const unixTimestampToDate = (ts) => {
    const d = new Date(ts * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleRetrieveRewards = async () => {
    if (!sdk) return;
    const dateFromMs = new Date(fromDate).getTime();
    const dateToMs = Date.now();
    const [_, vaultAddr] = selectedVaultOption.split(': ');

    const input = {
      dateFrom: Number(dateFromMs.toFixed(0)),
      dateTo: Number(dateToMs.toFixed(0)),
      userAddress,
      vaultAddress: vaultAddr
    };
    const output = await sdk.vault.getUserRewards(input);

    const records = Object.values(output).map(rec => {
      const date = unixTimestampToDate(rec.date / 1000);
      return { date, daily_reward: rec.dailyRewards, daily_reward_gbp: rec.dailyRewardsGbp };
    });
    setRewards(records);
    setExportData(records);
  };

  const exportRewards = () => {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rewards');
    const [n] = selectedVaultOption.split(': ');
    const filename = `${network.toLowerCase()}_${n.toLowerCase().replace(/ /g, '_')}_rewards.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // JSX
  return (
    <div className="App">
      <h1>Stakewise Rewards</h1>
      <form onSubmit={e => { e.preventDefault(); handleAddVault(); }}>
        <label className="form-label" htmlFor="form-vault-name">Vault name:</label>
        <input
          className="form-el"
          id="form-vault-name"
          type="text"
          value={formVaultName}
          onChange={e => { setFormVaultName(e.target.value); setAddDisabled(false); }}
          placeholder="Vault name"
        />
        <label className="form-label" htmlFor="form-vault-address">Vault address:</label>
        <input
          className="form-el"
          id="form-vault-address"
          type="text"
          value={formVaultAddress}
          onChange={e => { setFormVaultAddress(e.target.value); setAddDisabled(false); }}
          placeholder="Vault address"
        />
        <div className="form-buttons">
          <button type="submit" className="form-btn" disabled={addDisabled}>Add</button>
          <button type="button" className="form-btn" onClick={handleDeleteVault} disabled={deleteDisabled}>Delete</button>
        </div>
      </form>
      <div className="grid-container">
        <div className="grid-label"><label htmlFor="network-name">Network:</label></div>
        <div className="network-selector">
          <select id="network-name" className="network-el" value={network} onChange={e => setNetwork(e.target.value)}>
            <option value="Ethereum">Ethereum</option>
            <option value="Gnosis">Gnosis</option>
          </select>
        </div>

        <div className="grid-label"><label htmlFor="vault-address-el">Vault address:</label></div>
        <div className="vault-selector">
          <select
            id="vault-address-el"
            className="vault-address-el"
            value={selectedVaultOption}
            onChange={handleVaultOptionChange}
          >
            {vaultOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="grid-label"><label htmlFor="user-address-el">User address:</label></div>
        <div className="grid-input">
          <input
            id="user-address-el"
            className="input-el"
            type="text"
            value={userAddress}
            onChange={e => setUserAddress(e.target.value)}
          />
        </div>
        <div className="grid-button">
          <button className="buttons" id="user-address-save-btn" type="button" onClick={saveUserAddress}>Save User Address</button>
        </div>

        <div className="grid-label"><label htmlFor="from-date-el">From date:</label></div>
        <div className="grid-input">
          <input
            id="from-date-el"
            className="input-el"
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div className="grid-button">
          <button className="buttons" id="from-date-save-btn" type="button" onClick={saveFromDate}>Save From Date</button>
        </div>
      </div>

      <div className="button-grid">
        <div className="retrieve-column">
          <button className="buttons" id="retrieve-rewards-btn" type="button" onClick={handleRetrieveRewards}>Retrieve Rewards</button>
        </div>
        <div className="export-column">
          <button className="buttons" id="export-rewards-btn" type="button" onClick={exportRewards}>Export Rewards to Excel</button>
        </div>
      </div>

      <div className="rewards-grid" id="rewards-grid">
        <div id="reward-date">Date</div>
        <div id="reward-daily">Daily Rewards</div>
        <div id="reward-daily-gbp">Daily Rewards (GBP)</div>
        {rewards.map(r => (
          <Fragment key={r.date}>
            <div id="reward-date">{r.date}</div>
            <div id="reward-daily">{r.daily_reward}</div>
            <div id="reward-daily-gbp">{r.daily_reward_gbp}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
