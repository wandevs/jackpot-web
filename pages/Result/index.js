import { connect } from "react-redux";
import React from 'react';
import { Table, Button } from 'antd';
import style from './index.css';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';

import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { alertAntd, toUnitAmount } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../../utils/contract.js';

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
    while (this.props.selectedAccount === null) {
      await sleep(500);
    }
    this.updateDrawResult();
    this.resultTimer = setInterval(this.updateDrawResult, 20000);
  }

  componentWillUnmount() {
    clearInterval(this.resultTimer);
  }

  checkSCUpdate() {
    let scOld = window.localStorage.getItem(prefix+'_SC');
    if (!scOld || scOld !== lotterySCAddr) {
      console.log('Detect smart contract update.');
      window.localStorage.setItem(`${prefix}_SC`, lotterySCAddr);
      window.localStorage.removeItem(`${prefix}_historyStartBlock`);
    }
  }

  getHistoryStartBlock = () => {
    let startBlock = window.localStorage.getItem(`${prefix}_historyStartBlock`);
    if (startBlock && startBlock.length > 0) {
      return Number(startBlock);
    }
    let defaultStartBlock = 6000000;
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
      console.log('events:', events);
      for(let i = 0; i < events.length; i ++) {
        let block = await web3.eth.getBlock(events[i].blockNumber);
        // console.log('block:', block);
        let hasWinner = events[i].returnValues.amounts.length !== 1 || events[i].returnValues.amounts[0] !== '0';
        data.push({
          key: events[i].blockNumber,
          blockNumber: events[i].blockNumber,
          time: (new Date(Number(block.timestamp) * 1000)).toLocaleDateString(),
          jackpot: events[i].returnValues.winnerCode,
          amount: hasWinner ? events[i].returnValues.amounts.reduce((t, n) => t + n) : 0,
          winnerCount: hasWinner ? events[i].returnValues.amounts.length : 0,
        })
      }
    }
    this.setState({
      resultList: data,
      resultLoading: false,
    })
  }

  pastDrawResults = [
    {
      title: 'Draw',
      dataIndex: 'time',
      key: 'draw',
    },
    {
      title: 'Jackpot',
      dataIndex: 'jackpot',
      key: 'jackpot',
    },
    {
      title: 'Prize',
      dataIndex: 'amount',
      key: 'prize',
    },
    {
      title: 'Winner',
      dataIndex: 'winnerCount',
      key: 'winnerCount',
    },
  ]

  render() {
    const { resultLoading, resultList } = this.state;

    return (
      <div className={style.normal}>
        <div className={style.title5}>
            Past Draw Results
        </div>

        <div style={{ height: "20px" }}></div>
        <div className={'table'}>
          <Table columns={this.pastDrawResults} dataSource={resultList}  loading={resultLoading} />
        </div>
        <div style={{ height: "50px" }}></div>
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