import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { Tabs, Row, Col, Modal } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, getSelectedAccountWallet } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import "../pages/global.less";
import { toUnitAmount, keepOneDecimal } from '../utils/utils.js';
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

  howToPlay = () => {
    document.getElementById('gameRule').scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  render() {
    let { prizePool, totalPool, tabKeyNow, nextDraw } = this.state;
    return (
      <div className={style.layout}>
        <div className={style.header}>
          <Wallet title="Wan Game" nodeUrl={nodeUrl} />
          {/* <img className={style.logo} width="28px" height="28px" src={logo} alt="Logo" /> */}
          <div className={style.title}>Jack's Pot&nbsp;&nbsp;&nbsp;&nbsp;- The Wanchain based no loss lottery</div>
          <div className={style.howToPlay} onClick={this.howToPlay}>How to play</div>
          <img style={{ height: "25px", margin: "3px 8px 3px 3px" }} src={networkLogo} />
          <WalletButton />
        </div>

        <div className={style.mainContainer}>
          <div className={style.top}>
            <Row className={style.block1}>
              <Col span={11} className={style.leftPart}></Col>
              <Col span={13} className={style.rightPart}>
                {/* <Tooltip title={tooltipText}> </Tooltip> */}
                <div className={style.totalPool}>
                  <div className={style.label1}>Pool</div>
                  <div className={`${style.value} ${style.totalPoolValue}`}><img src={require('@/static/images/flag.png')} /><span>{keepOneDecimal(totalPool)}</span><span> WAN</span></div>
                </div>
                <div className={style.prizePool}>
                  <div className={style.label2}>Jackpot:</div>
                  <div className={`${style.value} ${style.prizePoolValue}`}><img src={require('@/static/images/trophy.png')} /><span>{keepOneDecimal(prizePool)}</span><span> WAN</span></div>
                </div>
                <div className={style.drawTime}>Next Draw Time: <span>{nextDraw}</span></div>
              </Col>
            </Row>
          </div>

          <div className={style.mainTab}>
            <Tabs onChange={this.onTabChange} activeKey={this.state.tabKeyNow} size={'large'}>
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

          <div id="gameRule" className={style['gameRule']}>
            <h1 className={style['ruleTitle']}>Jack’s Pot is a no-loss lottery game built on Wanchain</h1>
            <ul className={style['ruleContents']}>
              <li><span className={style['text']}>To play the game, users stake one or more tickets with a four digit number on each ticket.</span></li>
              <li><span className={style['text']}>Users may either choose a specific four digit number through “Self Selection”, or they may generate multiple tickets with randomly four chosen four digit numbers using “Machine Selection”.</span></li>
              <li><span className={style['text']}>In order to stake a ticket, users must supply 10 WAN for each ticket. This WAN will be locked up in a Wanchain validator node during the duration of the game, and users may withdraw this WAN when they are finished playing.</span></li>
              <li><span className={style['text']}>The WAN used by staking tickets is delegated to Wanchain’s validator nodes, and the accrued consensus rewards are pooled into the Jackpot.</span></li>
              <li><span className={style['text']}>Every Friday a winning four digit number is selected at random using Wanchain’s true random number generation, and the reward will be awarded to any users who are currently staking a winning number. If multiple users have tickets staked with the winning number, the Jackpot will be split proportionally amongst all tickets with the winning number.</span></li>
              <li><span className={style['text']}>The lottery closes at 00:00 UTC on Friday, lottery results are settled at 23:00 UTC on Friday, and the lottery re-opens at 00:00 UTC on Friday.</span></li>
              <li><span className={style['text']}>If there is no winner, the prize pot will automatically accumulate to the next cycle.</span></li>
              <li><span className={style['text']}>If you do not withdraw your tickets, those tickets will automatically participate in the next cycle with your chosen numbers.</span></li>
              {/* <li><span className={style['text']}></span></li> */}
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
