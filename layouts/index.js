import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { message } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, getSelectedAccountWallet } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './style.less';
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { lotterySC } from '../utils/contract.js';
import { networkId, nodeUrl } from '../conf/config.js';
import { Link } from 'umi';
import sleep from 'ko-sleep';

const networkLogo = networkId == 1 ? 'https://img.shields.io/badge/Wanchain-Mainnet-green.svg' : 'https://img.shields.io/badge/Wanchain-Testnet-green.svg';

class Layout extends Component {
  constructor(props) {
    super(props);
    this.state = {
      totalPool: 0,
      prizePool: 0,
      nextDraw: '2020-04-25 07:00:00 (UTC+8)',
      closeHours: 24,
      raffleCount: 0,
      totalStake: 0,
      totalPrize: 0,
    };
  }

  componentWillMount() {

  }

  async componentDidMount() {
    try {
      let setStakerInfo = async (address) => {
        let { prize, codeCount } = await lotterySC.methods.userInfoMap(address).call();
        this.setState({
          totalPrize: parseInt(prize) + 11,
          raffleCount: parseInt(codeCount) + 22,
        });
      }

      let updateData = async () => {
        let { prizePool } = await lotterySC.methods.poolInfo().call();
        while (this.props.selectedAccount === null) {
          await sleep(500);
        }
        let address = this.props.selectedAccount.get('address');
        console.log('address:', address);
        if (address) {
          setStakerInfo(address);
        }
        this.setState({
          prizePool: parseInt(prizePool) + 123
        });
      }
      
      updateData();
      this.timer = setInterval(updateData, 30000);
    } catch (err) {
      console.log('err:', err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  chooseRaffleNum = () => {
    let { path } = this.props.location;
    if (path === '/') {
      let domObj = document.getElementById('entryArea');
      if (domObj !== null) {
        domObj.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    } else {
      setTimeout(() => {
        let domObj = document.getElementById('entryArea');
        if (domObj !== null) {
          domObj.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 50);
    }
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
          <div className={style.title2}>Up to {this.state.totalPool} WAN Total Pool</div>
          <div className={style.centerLine}>
            <div className={style.title3}>Prize Pool:</div>
            <div className={style.title4}>{this.state.prizePool} WAN</div>
          </div>
          <div>
            Next Draw Time：{this.state.nextDraw}
          </div>
          <div>
            Draw Entry Close: {this.state.closeHours} hour before the draw time
          </div>
          <div className={style.chance}>
            <div className={style.chanceLeft}>
              <p>You Have {this.state.raffleCount} Raffle Number</p>
              <p>Total {this.state.totalStake} WAN in Jack's Pot Stake</p>
            </div>
            <div className={style.chanceCenter}>
              <Link to="/" className={style.centerButton} onClick={this.chooseRaffleNum} replace>Choose A Raffle Number</Link>
            </div>
            <div className={style.chanceRight}>
              <p>Total Prize You've Received:</p>
              <p>{this.state.totalPrize} WAN</p>
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
