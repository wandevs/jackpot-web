import React from 'react'
import Web3Modal from '@wandevs/web3modal';
import { WanWalletConnector } from '@web3-react-wan/wanwallet-connector'
import WalletConnect from "@walletconnect/web3-provider";
import Web3 from "web3";
import { networkId } from '../conf/config';
const chainId = networkId;

const INITIAL_STATE = {
  address: "",
  web3: null,
  provider: null,
  connected: false,
  networkId: 1,
  chainType: "wan"
};

function initWeb3(provider) {
  const web3 = new Web3(provider);
  return web3;
}


class Wallet extends React.Component {
  constructor(props) {
    super(props);
    const intiState = {
      ...INITIAL_STATE,
      resetApp: this.resetApp,
      connect: this.onConnect,
      logo: this.getLogo,
    };

    this.setWallet = props.setWallet;
    this.setWallet(intiState);

    if (typeof window === 'undefined') {
      return;
    }
    
    console.debug('new web3modal');
    this.web3Modal = new Web3Modal({
      network: 'mainnet',
      cacheProvider: true,
      disableInjectedProvider: false,
      providerOptions: this.getProviderOptions()
    });
  }

  componentDidMount() {
    console.debug('web3Modal.cachedProvider', this.web3Modal.cachedProvider);
    if (this.web3Modal.cachedProvider) {
      if (this.web3Modal.cachedProvider === 'wanmask' && !window.wanchain) {
        this.web3Modal.clearCachedProvider();
        return;
      }
      this.onConnect();
    }
  }

  getLogo = () => {
    return this.web3Modal.getLogo();
  }

  onConnect = async () => {
    let provider;
    
    try {
      if (window.injectWeb3) {
        provider = await this.web3Modal.connectTo('wanwallet');
      } else {
        provider = await this.web3Modal.connect();
      }
    } catch (error) {
      console.error(error);
    }

    if (!provider) {
      return;
    }

    await this.subscribeProvider(provider);

    const web3 = initWeb3(provider);

    const accounts = await web3.eth.getAccounts();

    const address = accounts[0];

    const networkId = await web3.eth.net.getId();

    await this.setWallet({
      web3,
      provider,
      connected: true,
      address,
      networkId,
      chainType: this.web3Modal.cachedProvider === 'wanmask' || this.web3Modal.cachedProvider === 'wanwallet' ? 'wan' : 'eth',
      resetApp: this.resetApp,
      connect: this.onConnect,
      logo: this.getLogo,
    });
  };

  subscribeProvider = async (provider) => {
    if (!provider || !provider.on) {
      return;
    }
    provider.on("close", () => this.resetApp());
    provider.on("accountsChanged", async (accounts) => {
      await this.setWallet({ ...this.props.wallet, address: accounts[0] });
    });
    provider.on("chainChanged", async () => {
      const { web3 } = this.props.wallet;
      const networkId = await web3.eth.net.getId();
      await this.setWallet({ ...this.props.wallet, networkId });
    });

    provider.on("networkChanged", async (networkId) => {
      await this.setWallet({ ...this.props.wallet, networkId });
    });
  };

  getProviderOptions = () => {
    const providerOptions = {
      wanmask: {
        package: {},
        opts: {
          config: {}
        }
      },
      wanwallet: {
        package: new WanWalletConnector({
          chainId: 1,
          url: 'https://gwan-ssl.wandevs.org:56891',
          pollingInterval: 15000,
          requestTimeoutMs: 300000
        })
      },
      walletconnect: {
        package: WalletConnect,
        options: {
          infuraId: '326fb0397704475abffcfa9ca9c0ee5a',
          rpcUrl: 'https://gwan-ssl.wandevs.org:56891',
          chainId: 888,
          networkId: 888,
          rpc: {
            888: 'https://gwan-ssl.wandevs.org:56891',
            999: 'https://gwan-ssl.wandevs.org:46891',
          },
        },
      },
    };
    return providerOptions;
  };

  resetApp = async () => {
    if (!this.web3Modal) {
      return;
    }

    const { web3 } = this.props.wallet;
    if (web3 && web3.currentProvider && web3.currentProvider.close) {
      await web3.currentProvider.close();
    }
    await this.web3Modal.clearCachedProvider();
    this.setWallet({ ...INITIAL_STATE, 
      resetApp: this.resetApp,
      connect: this.onConnect
    });
  };

  render() {
    return (<></>)
  }
}

export default Wallet;