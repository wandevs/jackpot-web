import { connect } from "react-redux";
import React from 'react';
import { Table, Button } from 'antd';
import style from './index.less';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';
import RefundPrincipalModal from '../../components/RefundPrincipalModal';
import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt, WalletButtonLong } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { alertAntd, toUnitAmount, formatRaffleNumber } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../../utils/contract.js';
import { watchTransactionStatus } from '../../utils/common.js';
import { price } from '../../conf/config.js';

const prefix = 'jackpot';

class History extends Component {
  constructor(props) {
    super(props);
    this.state = {
      historyLoading: true,
      principalButtonLoading: false,
      historyList: [],
      selectedRowKeys: [],
      selectedRows: [],
      modalVisible: false,
    }
  }

  async componentDidMount() {
    while (this.props.selectedAccount === null) {
      await sleep(500);
    }
    await this.resetHistoryData();
    this.setState({
      historyLoading: false
    });
  }

  componentWillUnmount() {
    clearInterval(this.resultTimer);
  }

  resetHistoryData = async () => {
    this.setState({
      historyList: await this.getHistoryData(),
    });
  }

  getHistoryData = async () => {
    let address = this.props.selectedAccount.get('address');
    let ret = await lotterySC.methods.getUserCodeList(address).call();
    let { amounts, codes } = ret;
    let data = amounts.map((v, i) => ({
      key: i + 1,
      code: codes[i],
      times: web3.utils.fromWei(v) / price,
      from: address,
      price: web3.utils.fromWei(v)
    }));
    return data;
  }

  myDrawColumns = [
    {
      title: 'INDEX',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: "RAFFLE NUMBER",
      dataIndex: 'code',
      key: 'code',
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
      title: "MULTIPLE OF DRAWS",
      dataIndex: 'times',
      key: 'times',
      align: 'center'
    },
    {
      title: "PRICE",
      dataIndex: "price",
      key: "price",
      align: 'center',
      render: text => (<span className={'price'}>{text} WAN</span>)
    },
    {
      title: "FROM",
      dataIndex: "from",
      key: "from",
    },
  ]

  onSelectChange = (selectedRowKeys, selectedRows) => {
    this.setState({ selectedRowKeys, selectedRows });
  }

  refundPrincipal = () => {
    this.setState({ modalVisible: true })
  }

  hideModal = () => {
    this.setState({ modalVisible: false });
  }

  sendRefundPrincipalTx = async () => {
    const { selectedRows } = this.state;
    const { selectedAccount, selectedWallet } = this.props;
    const codes = selectedRows.map(v => Number(v.code));
    const encoded = await lotterySC.methods.redeem(codes).encodeABI();
    const address = selectedAccount ? selectedAccount.get('address') : null;

    if (codes.length === 0) {
      alertAntd('Please select at least one row to refund.');
      return false
    }

    if (!address || address.length < 20) {
      alertAntd('Please select a wallet address first.');
      return false
    }

    this.setState({
      principalButtonLoading: true,
      historyLoading: true,
    });

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

    if (params.gasLimit == -1) {
      alertAntd('Estimate Gas Error. Maybe out of time range.');
      return false;
    }

    // console.log('params:', params);

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      // console.log('tx ID:', transactionID);
      watchTransactionStatus(transactionID, (ret) => {
        if (ret) {
          alertAntd('Refund success');
        } else {
          alertAntd('Refund failed');
        }
        this.setState({
          principalButtonLoading: false,
          historyLoading: false,
          selectedRows: [],
          selectedRowKeys: [],
        });
        this.resetHistoryData();
      });
      return transactionID;
    } catch (err) {
      console.log(err.message);
      alertAntd(err.message);
      this.setState({
        principalButtonLoading: false,
        historyLoading: false,
        selectedRows: [],
        selectedRowKeys: [],
      });
      return false;
    }
  }

  estimateSendGas = async (value, selectUp, address) => {
    try {
      let ret = await lotterySC.methods.redeem(selectUp).estimateGas({ gas: 10000000, value, from: address });
      if (ret == 10000000) {
        return -1;
      }
      return '0x' + (ret + 30000).toString(16);
    } catch (err) {
      console.log(err.message);
      return -1;
    }
  }

  render() {
    const { selectedRowKeys, historyLoading, principalButtonLoading, historyList } = this.state;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
      hideDefaultSelections: false,
      fixed: true,
    }
    return (
      <div className={style.normal}>
        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>My Draw History</span>
        </div>
        <div className={'table'}>
          <Table rowSelection={rowSelection} columns={this.myDrawColumns} dataSource={historyList} loading={historyLoading} />
          <div className={style['centerLine']}>
            <div className={'guess-button ellipsoidalButton'} /* loading={principalButtonLoading} */ onClick={this.refundPrincipal}>Refund Principal</div>
            {/* <div className={'guess-button ellipsoidalButton'} onClick={this.refundPrize}>Refund Prize</div> */}
          </div>
        </div>
        <div style={{ height: "30px" }}></div>

        {
          this.state.modalVisible && <RefundPrincipalModal
            sendTransaction={this.sendRefundPrincipalTx}
            hideModal={this.hideModal}
            data={this.state.selectedRows}
            WalletButton={WalletButtonLong} />
        }
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
})(History);