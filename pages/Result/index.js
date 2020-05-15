import { connect } from "react-redux";
import React from 'react';
import { Table, message } from 'antd';
import style from './index.less';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';

import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { toUnitAmount, formatRaffleNumber, keepOneDecimal } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../../utils/contract.js';
import { defaultStartBlock } from '../../conf/config.js';

const prefix = 'jackpot';

class Result extends Component {
  constructor(props) {
    super(props);
    this.checkSCUpdate();
    this.state = {
      resultLoading: true,
      resultList: [],
    }
  }

  async componentDidMount() {
    let timer = 0;
    while (this.props.selectedAccount === null) {
      if (timer > 10) {
        message.info('Account is not found.');
        this.setState({
          resultLoading: false,
        });
        return false;
      }
      await sleep(500);
      timer++;
    }

    this.updateDrawResult();
    this.resultTimer = setInterval(this.updateDrawResult, 20000);
  }

  componentWillUnmount() {
    clearInterval(this.resultTimer);
  }

  checkSCUpdate() {
    let scOld = window.localStorage.getItem(prefix + '_SC');
    if (!scOld || scOld !== lotterySCAddr) {
      // console.log('Detect smart contract update.');
      window.localStorage.setItem(`${prefix}_SC`, lotterySCAddr);
      window.localStorage.removeItem(`${prefix}_historyStartBlock`);
    }
  }

  getHistoryStartBlock = () => {
    let startBlock = window.localStorage.getItem(`${prefix}_historyStartBlock`);
    if (startBlock && startBlock.length > 0) {
      return Number(startBlock);
    }
    return defaultStartBlock;
  }

  updateDrawResult = async () => {
    let blockNumber = await web3.eth.getBlockNumber();
    let events = await lotterySC.getPastEvents('LotteryResult', {
      fromBlock: this.getHistoryStartBlock(),
      toBlock: blockNumber
    });
    let data = [];
    if (events && events.length > 0) {
      // console.log('events:', events);
      for (let i = 0; i < events.length; i++) {
        let block = await web3.eth.getBlock(events[i].blockNumber);
        let hasWinner = events[i].returnValues.amounts.length !== 1 || events[i].returnValues.amounts[0] !== '0';
        data.push({
          key: events[i].blockNumber,
          blockNumber: events[i].blockNumber,
          time: (new Date(Number(block.timestamp) * 1000)).toLocaleDateString(),
          jackpot: events[i].returnValues.winnerCode,
          amount: web3.utils.fromWei(events[i].returnValues.prizePool),
          winnerCount: hasWinner ? events[i].returnValues.amounts.length : 0,
          winners: hasWinner ? events[i].returnValues.winners : 'No winners.',
          amounts: hasWinner ? events[i].returnValues.amounts : [],
        })
      }
    }
    this.setState({
      resultList: data.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
      resultLoading: false,
    })
  }

  pastDrawResults = [
    {
      title: 'DRAW',
      dataIndex: 'time',
      key: 'draw',
      align: 'center',
    },
    {
      title: 'JACKPOT',
      dataIndex: 'jackpot',
      key: 'jackpot',
      align: 'center',
      render: text => {
        let arr = formatRaffleNumber(text).split('');
        arr = arr.map((s, i) => {
          return (<span key={i} className={i % 2 === 0 ? 'blueCircle' : 'redCircle'}>{s}</span>)
        });
        return <span key={text}>{arr}</span>
      }
    },
    {
      title: 'PRIZE',
      dataIndex: 'amount',
      key: 'prize',
      align: 'center',
      render: text => (<span className={'price'}>{keepOneDecimal(text)} WAN</span>)
    },
    {
      title: 'WINNER',
      dataIndex: 'winnerCount',
      key: 'winnerCount',
      align: 'center',
    },
  ]

  render() {
    const { resultLoading, resultList } = this.state;
    return (
      <div className={style.normal}>
        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>Past Draw Results</span>
        </div>

        <div style={{ height: "20px" }}></div>
        <div className={'table'}>
          <Table
            columns={this.pastDrawResults}
            dataSource={resultList}
            loading={resultLoading}
            expandedRowRender={record => {
              if (typeof record.winners === 'string') {
                return <p style={{ margin: 0 }}>{record.winners}</p>;
              } else {
                return (<ul className={style.detailList}>
                  {record.winners.map((v, i) => <li key={v}>Winner: {v} &nbsp;&nbsp;&nbsp;&nbsp; Prize: {web3.utils.fromWei(record.amounts[i])} WAN</li>)}
                </ul>)
              }
            }}
          />
        </div>
        <div style={{ height: "50px" }}></div>
      </div>
    );
  }
}

export default connect(state => {
  const selectedAccountID = state.WalletReducer.get('selectedAccountID');
  return {
    selectedAccount: getSelectedAccount(state),
    selectedWallet: getSelectedAccountWallet(state),
    networkId: state.WalletReducer.getIn(['accounts', selectedAccountID, 'networkId']),
    selectedAccountID,
    wanBalance: toUnitAmount(state.WalletReducer.getIn(['accounts', selectedAccountID, 'balance']), 18),
  }
})(Result);