import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { Tabs, Row, Col, Modal } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, getSelectedAccountWallet } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import "../pages/global.less";
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../utils/contract.js';
import { networkId, nodeUrl } from '../conf/config.js';
import sleep from 'ko-sleep';
import BigNumber from 'bignumber.js';

import Entry from '../pages/Entry';
import History from '../pages/History';
import Result from '../pages/Result';

const networkLogo = networkId == 1 ? 'https://img.shields.io/badge/Wanchain-Mainnet-green.svg' : 'https://img.shields.io/badge/Wanchain-Testnet-green.svg';
const { TabPane } = Tabs;
const { confirm } = Modal;

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
      tabKeyNow: '1'
    };
  }

  async componentDidMount() {
    try {
      this.setNextDraw();

      let updatePoolInf = async () => {
        let ret = await lotterySC.methods.poolInfo().call();
        let { prizePool, demandDepositPool, delegatePool } = ret;
        let total = new BigNumber(web3.utils.fromWei(prizePool)).plus(web3.utils.fromWei(demandDepositPool)).plus(web3.utils.fromWei(delegatePool)).toString();
        this.setState({
          prizePool: web3.utils.fromWei(prizePool),
          totalPool: total,
        });
      }
      
      updatePoolInf();
      this.timer = setInterval(() => {
        updatePoolInf();
      }, 30000);
    } catch (err) {
      console.log('err:', err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  setNextDraw = () => {
    let n = new Date();
    let time1 = n.getTime();
    n.setUTCHours(23);
    n.setUTCMinutes(0);
    n.setUTCSeconds(0);
    n.setUTCMilliseconds(0);
    let time2 = n.getTime();
    const UTC_Day = n.getUTCDay();
    let time = 0;
    if (UTC_Day < 5) {
      time = new BigNumber(5 - UTC_Day).times(24).times(3600000).plus(time2).toNumber();
    } else if (UTC_Day === 5) {
      if (time1 < time2) {
        time = time2;
      } else {
        time = new BigNumber(7).times(24).times(3600000).plus(time2).toNumber();
      }
    } else if (UTC_Day > 5) {
      time = new BigNumber(5 + 7 - UTC_Day).times(24).times(3600000).plus(time2).toNumber();
    }
    this.setState({
      nextDraw: new Date(time).toString()
    })
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

  onTabChange = (activeKey) => {
    this.setState({ tabKeyNow: activeKey });
  }

  render() {
    let { prizePool, totalPool, tabKeyNow, nextDraw } = this.state;
    return (
      <div className={style.layout}>
        <div className={style.header}>
          <Wallet title="Wan Game" nodeUrl={nodeUrl} />
          {/* <img className={style.logo} width="28px" height="28px" src={logo} alt="Logo" /> */}
          <div className={style.title}>Jack's Pot</div>
          <img style={{ height: "25px", margin: "3px 8px 3px 3px" }} src={networkLogo} />
          <WalletButton />
        </div>

        <div className={style.mainContainer}>
          <div className={style.top}>
            <Row className={style.block1}>
              <Col xs={12} sm={12} md={11} lg={11} xl={11} className={style.leftPart}></Col>
              <Col xs={12} sm={12} md={13} lg={12} xl={13} className={style.rightPart}>
                {/* <Tooltip title={tooltipText}> </Tooltip> */}
                <div className={style.totalPool}>
                  <div className={style.label1}>Pool</div>
                  <div className={`${style.value} ${style.totalPoolValue}`}><img src={require('@/static/images/flag.png')} /><span>{totalPool}</span><span> WAN</span></div>
                </div>
                <div className={style.prizePool}>
                  <div className={style.label2}>Jackpot:</div>
                  <div className={`${style.value} ${style.prizePoolValue}`}><img src={require('@/static/images/trophy.png')} /><span>{prizePool}</span><span> WAN</span></div>
                </div>
                <div className={style.drawTime}>Next Draw Time: <span>{nextDraw}</span></div>
                <div className={style.drawClose}>Draw Entry Close: 24 hour before the draw time</div>
              </Col>
            </Row>
          </div>

          <div className={style.mainTab}>
            <Tabs /* defaultActiveKey="1" */ onChange={this.onTabChange} activeKey={this.state.tabKeyNow} size={'large'}>
              <TabPane tab="Select Here" key="1">
                {
                  tabKeyNow === '1' ? <Entry /> : <div></div>
                }
              </TabPane>
              <TabPane tab="Your Tickets" key="2">
                {
                  tabKeyNow === '2' ? <History /> : <div></div>
                }
              </TabPane>
              <TabPane tab="Past Draw Results" key="3">
                {
                  tabKeyNow === '3' ? <Result /> : <div></div>
                }
              </TabPane>
            </Tabs>
          </div>

          <div className={'title'}>
            <img src={require('@/static/images/tag.png')} />
            <span>Game Rules</span>
          </div>

          <div className={style['gameRule']}>
            <h1 className={style['ruleTitle']}>Jack’s Pot is a no-loss lottery game built on Wanchain which draws from the design of the Ethereum based PoolTogether game while introducing novel game mechanics.</h1>
            <ul className={style['ruleContents']}>
              <li><span className={style['text']}>To play the game, participants deposit WAN while also guessing a number between 0 and 9 inclusive.</span></li>
              <li><span className={style['text']}>Participants' WAN deposits are delegated to POS verification nodes, and the accrued consensus rewards are pooled into a prize pot.</span></li>
              <li><span className={style['text']}>Every Friday a winning number is selected at random using Wanchain’s true random number generation, and the reward will be awarded proportionally to participants who guessed the winning number.</span></li>
              <li><span className={style['text']}>If there is no winner, the prize pot will automatically accumulate to the next cycle.</span></li>
            </ul>
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
