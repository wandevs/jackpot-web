import { connect } from "react-redux";
import React from 'react';
import { Table } from 'antd';
import style from './history.css';
import { Component } from '../components/base';
import sleep from 'ko-sleep';

import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../utils/contract.js';
import { price } from '../conf/config.js';

class History extends Component {
  constructor(props) {
    super(props);
    this.state = {
      historyLoading: true,
      historyList: [],
      resultList: [],
      selectedRowKeys: [],
      selectedRows: [],
    }
  }

  async componentDidMount() {
    while(this.props.selectedAccount === null) {
      await sleep(500);
    }

    let address = this.props.selectedAccount.get('address');
    // console.log('add:', address);
    let { amounts, codes } = await lotterySC.methods.getUserCodeList(address).call();
    // console.log('get Staker Code List:', amounts, codes);
    let data = amounts.map((v, i) => ({
      key: i + 1,
      code: codes[i],
      times: web3.utils.fromWei(v) / price,
      from: address,
      price: web3.utils.fromWei(v)
    }));
    this.setState({
      historyList: data,
      historyLoading: false
    });
  }

  myDrawColumns = [
    {
      title: 'Index',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: "Number",
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: "Multiple",
      dataIndex: 'times',
      key: 'times',
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
    },
    {
      title: "from",
      dataIndex: "from",
      key: "from",
    },
  ]

  pastDrawResults = [
    {
      title: 'Draw',
      dataIndex: 'draw',
      key: 'draw',
    },
    {
      title: 'Jackpot',
      dataIndex: 'jackpot',
      key: 'jackpot',
    },
    {
      title: 'Prize',
      dataIndex: 'prize',
      key: 'prize',
    },
  ]

  onSelectChange = (selectedRowKeys, selectedRows) => {
    console.log('selected: ', selectedRowKeys, selectedRows);
    this.setState({ selectedRowKeys, selectedRows });
  }

  refundPrincipal = async () => {
    const { selectedRowKeys, selectedRows } = this.state;
    const { selectedAccount, selectedWallet } = this.props;
    const codes = selectedRows.map(v => v.code);
    const encoded = await lotterySC.methods.redeem(codes).encodeABI();
    const address = selectedAccount ? selectedAccount.get('address') : null;
    console.log('refundPrincipal');
    console.log('refund:', selectedRows);
    console.log('codes:', codes);
    // console.log('encoded:', encoded);


    if (!address || address.length < 20) {
      alertAntd('Please select a wallet address first.');
      return false
    }

    const value = 0;
    let params = {
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x29E8D60800",
      gasLimit: "0x989680", // 10,000,000
    };

    if (selectedWallet.type() == "EXTENSION") {
      params.gas = await this.estimateSendGas(value, codes, address);
    } else {
      params.gasLimit = await this.estimateSendGas(value, codes, address);
    }

    console.log('gasLimit:', params.gasLimit);

    if (params.gasLimit == -1) {
      alertAntd('Estimate Gas Error. Maybe out of time range.');
      return false;
    }

    console.log('params:', params);

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      console.log('transactionID:', transactionID);
      this.watchTransactionStatus(transactionID, (ret) => {
        if (ret) {
          console.log('watch tx status');
        }
      });
      return transactionID;
    } catch (err) {
      console.log(err.message);
      alertAntd(err.message);
      return false;
    }
  }

  estimateSendGas = async (value, selectUp, address) => {
    try {
      let ret = await lotterySC.methods.redeem(selectUp).estimateGas({ gas: 10000000, value, from: address });
      console.log('=------es-----=:', ret);
      if (ret == 10000000) {
        return -1;
      }
      return '0x' + (ret + 30000).toString(16);
    } catch (err) {
      console.log(err.message);
      return -1;
    }
  }

  watchTransactionStatus = (txID, callback) => {
    const getTransactionStatus = async () => {
      const tx = await getTransactionReceipt(txID);
      if (!tx) {
        window.setTimeout(() => getTransactionStatus(txID), 3000);
      } else if (callback) {
        callback(Number(tx.status) === 1);
      } else {
        alertAntd('success');
      }
    };
    window.setTimeout(() => getTransactionStatus(txID), 3000);
  };

  refundPrize = () => {
    console.log('refundPrize');
  }

  render() {
    const { selectedRowKeys, historyLoading } = this.state;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
      hideDefaultSelections: false,
      fixed: true,
    }

    return (
      <div className={style.normal}>
        <div style={{ height: "50px" }}></div>
        <div className={style.title5}>
            My Draw History
          </div>
        <div style={{ height: "20px" }}></div>
        <div className={style.table}>
          <Table rowSelection={rowSelection} columns={this.myDrawColumns} dataSource={this.state.historyList} loading={historyLoading}/>
          <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.refundPrincipal}>退本金</div>
          <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.refundPrize}>退奖金</div>
        <div style={{ height: "20px" }}></div>

        </div>
        <div style={{ height: "30px" }}></div>
        <div className={style.title5}>{/* 开奖记录 */}
            Past Draw Results
        </div> 
        
        <div style={{ height: "20px" }}></div>
        <div className={style.table}>
          <Table columns={this.pastDrawResults} dataSource={this.state.resultList}/>
        </div>
        <div style={{ height: "50px" }}></div>
        <div style={{ height: "50px" }}></div>
      </div>
    );
  }
}

// export default History;

export default connect(state => {
  const selectedAccountID = state.WalletReducer.get('selectedAccountID');
  return {
    selectedAccount: getSelectedAccount(state),
    selectedWallet: getSelectedAccountWallet(state),
    networkId: state.WalletReducer.getIn(['accounts', selectedAccountID, 'networkId']),
    selectedAccountID,
    wanBalance: toUnitAmount(state.WalletReducer.getIn(['accounts', selectedAccountID, 'balance']), 18),
  }
})(History);