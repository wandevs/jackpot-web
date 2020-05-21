import { connect } from "react-redux";
import React from 'react';
import { Table, message, Input } from 'antd';
import style from './index.less';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';

import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { toUnitAmount, formatRaffleNumber, keepOneDecimal } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../../utils/contract.js';
import { defaultStartBlock } from '../../conf/config.js';

const prefix = 'jackpot';
const Result_length = 200;
const { Search } = Input;

class Result extends Component {
  constructor(props) {
    super(props);
    this.checkSCUpdate();
    this.state = {
      resultLoading: true,
      winnerFilter: false,
      resultList: [],
    }
  }

  async componentDidMount() {
    let timer = 0;
    while (this.props.selectedAccount === null) {
      if (timer > 10) {
        message.info(Lang.result.accountUnfounded);
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
      window.localStorage.setItem(`${prefix}_SC`, lotterySCAddr);
      window.localStorage.removeItem(`${prefix}_resultStartBlock`);
      window.localStorage.removeItem(`${prefix}_resultList`);
    }
  }

  getHistoryStartBlock = () => {
    let startBlock = window.localStorage.getItem(`${prefix}_resultStartBlock`);
    if (startBlock && startBlock.length > 0) {
      return Number(startBlock) + 1;
    }
    return defaultStartBlock;
  }

  updateDrawResult = async () => {
    let blockNumber = await web3.eth.getBlockNumber();
    let fromBlock = this.getHistoryStartBlock();
    let events = await lotterySC.getPastEvents('LotteryResult', {
      fromBlock: fromBlock < blockNumber ? fromBlock : blockNumber,
      toBlock: blockNumber
    });
    let oldData = window.localStorage.getItem(`${prefix}_resultList`);
    events.sort((a, b) => b.blockNumber - a.blockNumber);
    let newData = [];
    if (events && events.length > 0) {
      for (let i = 0; i < events.length; i++) {
        let block = await web3.eth.getBlock(events[i].blockNumber);
        let hasWinner = events[i].returnValues.amounts.length !== 1 || events[i].returnValues.amounts[0] !== '0';
        newData.push({
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
    let allData = newData.concat(oldData ? JSON.parse(oldData) : []);
    this.setState({
      resultList: allData.slice(0, Result_length), // Limit result list length.
      resultLoading: false,
    });
    window.localStorage.setItem(`${prefix}_resultStartBlock`, blockNumber);
    window.localStorage.setItem(`${prefix}_resultList`, JSON.stringify(allData));
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

  expandColumns = [
    {
      title: 'Address',
      dataIndex: 'winner',
      key: 'winner',
      align: 'left',
      width: '50%',
      // render: text => (<span className={'price'}>{keepOneDecimal(text)} WAN</span>)
    },
    {
      title: 'Prize',
      dataIndex: 'prize',
      key: 'prize',
      align: 'left',
      width: '50%',
      render: text => (<span className={'price'}>{text} WAN</span>)
    },
  ]

  onSearch = (v) => {
    this.setState({
      winnerFilter: v.trim().length > 0 ? v : false
    })
  }

  render() {
    const { resultLoading, resultList, winnerFilter } = this.state;
    let data = [];
    if (winnerFilter) {
      for (let i = 0; i < resultList.length; i++) {
        let item = resultList[i];
        if (item.winners instanceof Array) {
          for(let j = 0; j < item.winners.length; j ++) {
            if (item.winners[j].toLowerCase() === winnerFilter.toLowerCase()) {
              data.push(item);
              break;
            }
          }
        }
      }
    } else {
      data = resultList;
    }

    return (
      <div className={style.normal}>
        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>Past Draw Results</span>
          <Search className={style.searchAddress} placeholder="Search by address" style={{ width: 300 }} onSearch={this.onSearch} enterButton />
        </div>

        <div style={{ height: "20px" }}></div>
        <div className={'table'}>
          <Table
            columns={this.pastDrawResults}
            dataSource={data}
            loading={resultLoading}
            pagination={{ defaultCurrent: 1, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
            expandedRowRender={record => {
              if (typeof record.winners === 'string') {
                return <p style={{ margin: 0 }}>{record.winners}</p>;
              } else {
                let data = record.winners.map((v, i) => ({
                  winner: v,
                  prize: keepOneDecimal(web3.utils.fromWei(record.amounts[i]))
                }))
                return (
                  <Table
                    rowKey="winner"
                    className={style.expandedTable}
                    columns={this.expandColumns}
                    dataSource={data}
                    pagination={false}
                    size="small"
                  />
                )
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