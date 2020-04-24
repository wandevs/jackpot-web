import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { message } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, WalletButtonLong, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './style.less';
// import logo from '../img/wandoraLogo.png';
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { networkId, nodeUrl } from '../conf/config.js';
import { Link } from 'umi';


const networkLogo = networkId == 1 ? 'https://img.shields.io/badge/Wanchain-Mainnet-green.svg' : 'https://img.shields.io/badge/Wanchain-Testnet-green.svg';

class Layout extends Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {

  }

  render() {
    return (
      <div>
        <div className={style.header}>
          <Wallet title="Wan Game" nodeUrl={nodeUrl} />
          {/* <img className={style.logo} width="28px" height="28px" src={logo} alt="Logo" /> */}
          <div className={style.title}>Jack's Pot</div>
          <img style={{ height: "25px", margin: "3px 8px 3px 3px" }} src={networkLogo} />
          <div className={style.gameRule} onClick={this.showGameRule}>Game Rules</div>
          <WalletButton />
        </div>
        {this.props.selectedAccountID === 'EXTENSION' && parseInt(this.props.networkId, 10) !== parseInt(networkId, 10) && (
          <div className="network-warning bg-warning text-white text-center" style={{ padding: 4, backgroundColor: "red", textAlign: "center" }}>
            Please be noted that you are currently choosing the Testnet for WanMask and shall switch to Mainnet for playing Wandora.
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <div className={style.title1}>Choose Your Jack's Pot Number</div>
          <div className={style.title2}>Up to {135} WAN No-Loss Prize</div>
          <div className={style.centerLine}>
            <div className={style.title3}>Price Pool:</div>
            <div className={style.title4}>135 WAN</div>
          </div>
          <div>
            Next Draw Time：2020-04-25 00: 40: 00 (UTC+8)
          </div>
          <div>
            Draw Entry Close: 24 hour before the draw time
          </div>
          <div className={style.chance}>
          <div className={style.chanceLeft}>
            <p>You Have 1 Raffle Number</p>
            <p>Total 10 WAN in Jack's Pot Stake</p>
          </div>
          <div className={style.chanceCenter}>
            <Link to="/" className={style.centerButton}>Choose A Raffle Number</Link>
          </div>
          <div className={style.chanceRight}>
            <p>Total Prize You've Received:</p>
            <p>120 WAN</p>
          </div>
        </div>
        </div>
        {this.props.children}
      </div>
    );
  }
}

export default withRouter(connect(state => {
  const selectedAccountID = state.WalletReducer.get('selectedAccountID');
  return {
    selectedAccount: getSelectedAccount(state),
    selectedWallet: getSelectedAccountWallet(state),
    networkId: state.WalletReducer.getIn(['accounts', selectedAccountID, 'networkId']),
    selectedAccountID,
    wanBalance: toUnitAmount(state.WalletReducer.getIn(['accounts', selectedAccountID, 'balance']), 18),
  }
})(Layout));
