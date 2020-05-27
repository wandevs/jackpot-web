import { Component } from 'react';
import withRouter from 'umi/withRouter';
import { connect } from 'react-redux';
import { Tabs, Row, Col, Modal } from 'antd';
import { Wallet, getSelectedAccount, WalletButton, getSelectedAccountWallet } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import "../pages/global.less";
import { toUnitAmount, keepOneDecimal, formatRaffleNumber } from '../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../utils/contract.js';
import { networkId, nodeUrl, defaultStartBlock } from '../conf/config.js';
import BigNumber from 'bignumber.js';

import Entry from '../pages/Entry';
import History from '../pages/History';
import Result from '../pages/Result';
const networkLogo = networkId == 1 ? require('@/static/images/mainnet.svg') : require('@/static/images/testnet.svg');
const { TabPane } = Tabs;

class Layout extends Component {
  constructor(props) {
    super(props);
    this.state = {
      totalPool: 0,
      prizePool: 0,
      // nextDraw: '2020-04-25 07:00:00 (UTC+8)',
      tabKeyNow: '1',
      jackpot: '0000',
      showCounter: false,
      timeToClose: {
        d: '00',
        h: '00',
        m: '00',
        s: '00',
      },
    };
  }

  async componentDidMount() {
    try {
      this.setTimeToClose();
      this.resetLatestDrawResult();
      this.timer1 = setInterval(this.setTimeToClose, 1000);

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
      this.timer2 = setInterval(() => {
        updatePoolInf();
      }, 30000);
    } catch (err) {
      console.log('err:', err);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer1);
    clearInterval(this.timer2);
  }

  setTimeToClose = () => {
    const { showCounter } = this.state;
    let n = new Date();
    let time1 = n.getTime();
    n.setUTCHours(0);
    n.setUTCMinutes(0);
    n.setUTCSeconds(0);
    n.setUTCMilliseconds(0);
    let time2 = n.getTime();
    const UTC_Day = n.getUTCDay();
    let time = 0;
    if (UTC_Day < 5) {
      time = new BigNumber(5 - UTC_Day).times(24).times(3600000).plus(time2).minus(time1).toNumber();
    } else if (UTC_Day === 5) {
      if (time1 < time2) {
        time = time2 - time1;
      } else {
        time = new BigNumber(7).times(24).times(3600000).plus(time2).minus(time1).toNumber();
      }
    } else if (UTC_Day > 5) {
      time = new BigNumber(5 + 7 - UTC_Day).times(24).times(3600000).plus(time2).minus(time1).toNumber();
    }

    time = parseInt(time / 1000);

    const past = (7 * 24 * 3600 - time);

    if (past > 23 * 3600 && !showCounter) {
      this.setState({
        showCounter: true
      });
    } else if (past > 0 && past < 23 * 3600 && showCounter) {
      this.setState({
        showCounter: false
      });
    } else if (past === 0) {
      this.setState({
        showCounter: false
      });
    } else if (past === 23 * 3600) {
      this.resetLatestDrawResult();
      this.setState({
        showCounter: true
      });
    }

    const d = parseInt(time / 24 / 3600);
    time = time % (24 * 3600);
    const h = parseInt(time / 3600);
    time = time % 3600;
    const m = parseInt(time / 60);
    time = time % 60;
    const s = time;

    this.setState({
      timeToClose: {
        d: d.toString().padStart(2, '0'),
        h: h.toString().padStart(2, '0'),
        m: m.toString().padStart(2, '0'),
        s: s.toString().padStart(2, '0'),
      }
    });
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

  getHistoryStartBlock = () => {
    const prefix = 'jackpot';
    let startBlock = window.localStorage.getItem(`${prefix}_resultStartBlock`);
    if (startBlock && startBlock.length > 0) {
      return Number(startBlock) + 1;
    }
    return defaultStartBlock;
  }

  resetLatestDrawResult = async () => {
    const prefix = 'jackpot';
    let blockNumber = await web3.eth.getBlockNumber();
    let fromBlock = this.getHistoryStartBlock();
    let events = await lotterySC.getPastEvents('LotteryResult', {
      fromBlock: fromBlock < blockNumber ? fromBlock : blockNumber,
      toBlock: blockNumber
    });
    let jackpot = '0000';
    let localeData = window.localStorage.getItem(`${prefix}_resultList`);
    if (events.length > 0) {
      events.sort((a, b) => b.blockNumber - a.blockNumber);
      jackpot = formatRaffleNumber(events[0].returnValues.winnerCode);
    } else if (localeData !== null) {
      let oldData = JSON.parse(localeData);
      if (oldData && typeof (oldData) === 'object' && oldData.length > 0 && 'jackpot' in oldData[0]) {
        jackpot = oldData[0].jackpot
      }
      jackpot = formatRaffleNumber(jackpot);
    }
    this.setState({ jackpot });
  }

  openSC = () => {
    window.open('https://github.com/wandevs/jackpot-smart-contracts');
  }

  render() {
    let { prizePool, totalPool, tabKeyNow, jackpot, timeToClose, showCounter } = this.state;

    return (
      <div className={style.layout}>
        <div className={style.header}>
          <Wallet title="Wan Game" nodeUrl={nodeUrl} />
          <img className={style.logo} width="28px" height="28px" src={require('@/static/images/logo.png')} alt="Logo" />
          <div className={style.title}>Jack's Pot&nbsp;&nbsp;-&nbsp;&nbsp;The Wanchain based no loss lottery</div>
          <div className={style.howToPlay} onClick={this.howToPlay}>How to play</div>
          <img style={{ height: "25px", margin: "3px 8px 3px 3px" }} src={networkLogo} />
          <WalletButton />
        </div>

        <div className={style.mainContainer}>
          <div className={style.top}>
            <Row className={style.block1}>
              <Col span={12} className={style.leftPart}>
                <div className={style.slogan}>
                  PICK THE RIGHT NUMBER TO WIN!
                  FREE TO PLAY!
                </div>
                <div className={style.rafflePanel}>
                  {
                    jackpot.split('').map((v, i) => <span key={i} className={style.raffleNumber}>{v}</span>)
                  }
                </div>
                <div className={style.raffleTip}>Winning number last round</div>
              </Col>
              <Col span={12} className={style.rightPart}>
                <div className={style.totalPool}>
                  <div className={style.label1}>Pool</div>
                  <div className={`${style.value} ${style.totalPoolValue}`}><img src={require('@/static/images/flag.png')} /><span>{keepOneDecimal(totalPool)}</span><span> WAN</span></div>
                </div>
                <div className={style.prizePool}>
                  <div className={style.label2}>Jackpot</div>
                  <div className={`${style.value} ${style.prizePoolValue}`}><img src={require('@/static/images/trophy.png')} /><span>{keepOneDecimal(prizePool)}</span><span> WAN</span></div>
                </div>
                {
                  showCounter ? <React.Fragment>
                    <div className={style.drawTime}>This round closes in:</div>
                    <div className={style.timer}>
                      <div className={style.timeLeft}>
                        <div className={style.timeValue}>{timeToClose.d}</div>
                        <div className={style.timeUnit}>days</div>
                      </div>
                      <div className={style.colon}></div>
                      <div className={style.timeLeft}>
                        <div className={style.timeValue}>{timeToClose.h}</div>
                        <div className={style.timeUnit}>hours</div>
                      </div>
                      <div className={style.colon}></div>
                      <div className={style.timeLeft}>
                        <div className={style.timeValue}>{timeToClose.m}</div>
                        <div className={style.timeUnit}>minutes</div>
                      </div>
                      <div className={style.colon}></div>
                      <div className={style.timeLeft}>
                        <div className={style.timeValue}>{timeToClose.s}</div>
                        <div className={style.timeUnit}>seconds</div>
                      </div>
                    </div>
                    <div className={style.drawTimeTip}>Winnings are settled 23 hours after closing time</div>
                  </React.Fragment> : <div className={style.openTip}>This round of Jack's Pot has closed. Winnings will be settled at 23:00 UTC on Friday, and the next round begins at 00:00 UTC on Saturday.</div>
                }

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
              <li><span className={style['text']}>The lottery closes at 24:00 UTC Thursday, lottery results are settled at 23:00 UTC on Friday, and the lottery re-opens at 00:00 UTC on Saturday.</span></li>
              <li><span className={style['text']}>If there is no winner, the prize pot will automatically accumulate to the next cycle.</span></li>
              <li><span className={style['text']}>If you do not withdraw your tickets, those tickets will automatically participate in the next cycle with your chosen numbers.</span></li>
              <li><span className={style['text']}>Smart Contract Open Source:&nbsp;&nbsp;<a onClick={this.openSC} href="#">https://github.com/wandevs/jackpot-smart-contracts</a></span></li>
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
