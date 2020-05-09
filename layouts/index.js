import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { Tabs, Row, Col, message, Tooltip } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, getSelectedAccountWallet } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import "../pages/global.less";
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { web3, lotterySC } from '../utils/contract.js';
import { networkId, nodeUrl } from '../conf/config.js';
import { Link } from 'umi';
import sleep from 'ko-sleep';
import BigNumber from 'bignumber.js';

import Entry from '../pages/Entry';
import History from '../pages/History';
import Result from '../pages/Result';

const networkLogo = networkId == 1 ? 'https://img.shields.io/badge/Wanchain-Mainnet-green.svg' : 'https://img.shields.io/badge/Wanchain-Testnet-green.svg';
const { TabPane } = Tabs;

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
      poolInfo: {
        prizePool: 0,
        demandDepositPool: 0,
        delegatePool: 0,
        delegatePercent: 0
      }
    };
  }

  async componentDidMount() {
    try {
      // this.setNextDraw();
      let setStakerInfo = async (address) => {
        let ret = await lotterySC.methods.userInfoMap(address).call();
        console.log('ret:', ret);
        let { prize, codeCount } = ret;
        this.setState({
          totalPrize: parseInt(prize),
          raffleCount: parseInt(codeCount),
        });
      }

      let updateInfo = async () => {
        let ret = await lotterySC.methods.poolInfo().call();
        // console.log('poolInfo:', ret);
        let { prizePool, demandDepositPool, delegatePool, delegatePercent } = ret;
        while (this.props.selectedAccount === null) {
          await sleep(500);
        }
        let address = this.props.selectedAccount.get('address');
        // console.log('address:', address);
        if (address) {
          setStakerInfo(address);

          let drawHistory = await lotterySC.methods.getUserCodeList(address).call();
          let totalStake = drawHistory.amounts.reduce((t, n) => {
            return new BigNumber(t).plus(n);
          });
          this.setState({
            totalStake: web3.utils.fromWei(totalStake.toString()),
          });
        }
        let total = new BigNumber(web3.utils.fromWei(prizePool)).plus(web3.utils.fromWei(demandDepositPool)).plus(web3.utils.fromWei(delegatePool)).toString();
        this.setState({
          prizePool: web3.utils.fromWei(prizePool),
          totalPool: total,
          poolInfo: { prizePool: web3.utils.fromWei(prizePool), demandDepositPool: web3.utils.fromWei(demandDepositPool), delegatePool: web3.utils.fromWei(delegatePool), delegatePercent: new BigNumber(delegatePercent).div(10).toString() }
        });
      }

      updateInfo();
      this.timer = setInterval(updateInfo, 30000);
    } catch (err) {
      console.log('err:', err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  setNextDraw = () => {
    let n = new Date();
    let offset = n.getTimezoneOffset();
    console.log('n:', n.getTime());
    console.log('offset:', offset);
    let utc8 = n.getTime() + offset * 60000 + 8 * 3600 * 1000;
    console.log('utc8:', utc8);
    // console.log(new Date(utc8));
    let day = new Date(utc8).getDay();
    console.log('day:', day);
    // console.log('offset:', offset);
    /* this.setState({
      nextDraw: '2020-04-27 07:00:01 (UTC+8)'
    }) */
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

  onTabChange = () => {
    console.log('onTabChange');
  }

  render() {
    let { poolInfo, prizePool, raffleCount, totalStake, totalPrize, totalPool } = this.state;
    let tooltipText = <div>
      <p>Demand deposit pool: {poolInfo.demandDepositPool} WAN</p>
      <p>Prize pool: {prizePool} WAN</p>
      <p>Delegate pool: {poolInfo.delegatePool} WAN</p>
      <p>Delegate percent: {poolInfo.delegatePercent} %</p>
    </div>;
    return (
      <div className={style.layout}>
        <div className={style.header}>
          <Wallet title="Wan Game" nodeUrl={nodeUrl} />
          {/* <img className={style.logo} width="28px" height="28px" src={logo} alt="Logo" /> */}
          <div className={style.title}>Jack's Pot</div>
          <img style={{ height: "25px", margin: "3px 8px 3px 3px" }} src={networkLogo} />
          <div className={style.gameRule} onClick={this.showGameRule}>Game Rules</div>
          <WalletButton />
        </div>

        <div className={style.mainContainer}>
          <div className={style.top}>
            <Row className={style.block1}>
              <Col xs={12} sm={12} md={11} lg={11} xl={11} className={style.leftPart}></Col>
              <Col xs={12} sm={12} md={13} lg={12} xl={13} className={style.rightPart}>
                <div className={style.totalPool}>
                  <div className={style.label1}>Up tp WAN Total Pool</div>
                  <div className={`${style.value} ${style.totalPoolValue}`}><img src={require('@/static/images/flag.png')} /><span>{totalPool}</span><span> WAN</span></div>
                </div>
                <div className={style.prizePool}>
                  <div className={style.label2}>Prize Pool for Today:</div>
                  <div className={`${style.value} ${style.prizePoolValue}`}><img src={require('@/static/images/trophy.png')} /><span>{prizePool}</span><span> WAN</span></div>
                </div>
                <div className={style.drawTime}>Next Draw Time: <span>2020-04-25 07:00:00 (UTC+8)</span></div>
                <div className={style.drawClose}>Draw Entry Close: 24 hour before the draw time</div>
              </Col>
            </Row>
            <Row className={style.block2}>
              <Col span={6}>
                <p className={style.label}>You Have Raffle Number</p>
                <p className={style.value}>{raffleCount}</p>
              </Col>
              <Col span={6}>
                <p className={style.label}>Jack's Pot Stake</p>
                <p className={style.value}>{totalStake} WAN</p>
              </Col>
              <Col span={12}>
                <p className={style.label}>Total Prize You've Received:</p>
                <p className={`${style.value} ${style.totalPrize}`}>{totalPrize} WAN</p>
              </Col>
            </Row>
          </div>
          <div className={style.mainTab}>
            <Tabs defaultActiveKey="2" onChange={this.onTabChange} size={'large'}>
              <TabPane tab="Entry Area" key="1">
                <Entry/>
            </TabPane>
              <TabPane tab="Draw History" key="2">
                <History/>
            </TabPane>
              <TabPane tab="Past Draw Results" key="3">
                <Result/>
            </TabPane>
            </Tabs>
          </div>
        </div>

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
