import { connect } from "react-redux";
import React from 'react';
import { Table, Row, Col, message, Spin, Popconfirm } from 'antd';
import style from './index.less';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';
import BigNumber from 'bignumber.js';
import RefundPrincipalModal from '../../components/RefundPrincipalModal';
import { getSelectedAccount, getSelectedAccountWallet, getTransactionReceipt, WalletButtonLong } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import { alertAntd, toUnitAmount, formatRaffleNumber, keepOneDecimal } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr, lotteryClosed } from '../../utils/contract.js';
import { watchTransactionStatus } from '../../utils/common.js';
import { price } from '../../conf/config.js';
import Lang from '../../conf/language.js';

class History extends Component {
  constructor(props) {
    super(props);
    this.state = {
      historyLoading: true,
      stakerInfoLoading: true,
      principalButtonLoading: false,
      historyList: [],
      selectedRowKeys: [],
      selectedRows: [],
      modalVisible: false,
      raffleCount: 0,
      totalStake: 0,
      totalPrize: 0,
    }
  }

  myDrawColumns = [
    {
      title: 'INDEX',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: "NUMBER",
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
      title: "DRAWS",
      dataIndex: 'times',
      key: 'times',
      align: 'center'
    },
    {
      title: "AMOUNT",
      dataIndex: "price",
      key: "price",
      align: 'center',
      render: text => (<span className={'price'}>{text} WAN</span>)
    },
    {
      title: "STATUS",
      dataIndex: "exit",
      key: "exit",
      render: text => {
        return text ? 'Quitting' : 'Normal'
      }
    },
  ]

  async componentDidMount() {
    let timer = 0;
    while (this.props.selectedAccount === null) {
      if (timer > 10) {
        message.info(Lang.history.accountUnfounded);
        this.setState({
          historyLoading: false,
          stakerInfoLoading: false,
        });
        return false;
      }
      await sleep(500);
      timer++;
    }
    await this.resetData();
    this.setState({
      historyLoading: false,
      stakerInfoLoading: false,
    });
  }

  componentWillUnmount() {
    clearInterval(this.resultTimer);
  }

  setStakerInfo = async () => {
    let address = this.props.selectedAccount.get('address');
    let { prize, codeCount } = await lotterySC.methods.userInfoMap(address).call();
    this.setState({
      totalPrize: toUnitAmount(parseInt(prize), 18),
      raffleCount: parseInt(codeCount),
    });
  }

  resetData = async () => {
    let address = this.props.selectedAccount.get('address');
    let historyData = await this.getHistoryData(address);
    this.setStakerInfo();
    let totalStake = historyData.reduce((t, n) => {
      return new BigNumber(t).plus(n.price);
    }, 0).toString();
    this.setState({
      historyList: historyData,
      totalStake,
    });
  }

  getHistoryData = async (address) => {
    let ret = await lotterySC.methods.getUserCodeList(address).call();
    let { amounts, codes, exits } = ret;
    let data = amounts.map((v, i) => ({
      key: i + 1,
      code: codes[i],
      times: web3.utils.fromWei(v) / price,
      from: address,
      price: web3.utils.fromWei(v),
      exit: exits[i] === '1'
    }));
    return data;
  }

  onSelectChange = (selectedRowKeys, selectedRows) => {
    this.setState({ selectedRowKeys, selectedRows });
  }

  refundPrincipal = async () => {
    let closed = await lotteryClosed();
    if (closed) {
      return;
    }

    if (this.state.selectedRowKeys.length === 0) {
      message.warning(Lang.history.selectRaffleToRedeem);
      return false;
    }

    if (this.state.selectedRows.every(r => r.exit === false)) {
      this.setState({ modalVisible: true })
    } else {
      message.warning(Lang.history.exitingNumber);
    }
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
      alertAntd(Lang.history.selectRow);
      return false
    }

    if (!address || address.length < 20) {
      alertAntd(Lang.history.selectAddress);
      return false
    }

    this.setState({
      principalButtonLoading: true,
      historyLoading: true,
      stakerInfoLoading: true,
    });

    const value = 0;
    let params = {
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x3B9ACA00",
      gasLimit: "0x989680", // 10,000,000
    };

    if (selectedWallet.type() == "EXTENSION") {
      params.gas = await this.estimateSendGas(value, codes, address);
    } else {
      params.gasLimit = await this.estimateSendGas(value, codes, address);
    }

    if (params.gasLimit == -1) {
      alertAntd(Lang.history.estimateGasError);
      return false;
    }

    console.log('params:', params);

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      watchTransactionStatus(transactionID, async (ret) => {
        if (ret) {
          alertAntd(Lang.history.redeemSuccess);
        } else {
          alertAntd(Lang.history.redeemFailed);
        }
        await this.resetData();
        this.setState({
          principalButtonLoading: false,
          historyLoading: false,
          stakerInfoLoading: false,
          selectedRows: [],
          selectedRowKeys: [],
        });
      });
      return transactionID;
    } catch (err) {
      console.log(err.message);
      alertAntd(err.message);
      this.setState({
        principalButtonLoading: false,
        historyLoading: false,
        stakerInfoLoading: false,
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

  estimateSendGas2 = async (value, address) => {
    try {
      let ret = await lotterySC.methods.prizeWithdraw().estimateGas({ gas: 10000000, value, from: address });
      if (ret == 10000000) {
        return -1;
      }
      return '0x' + (ret + 30000).toString(16);
    } catch (err) {
      console.log(err.message);
      return -1;
    }
  }

  onWithdrawPrize = async () => {
    let closed = await lotteryClosed();
    if (closed) {
      return;
    }

    const { totalPrize } = this.state;
    if (totalPrize === 0) {
      message.warning(Lang.history.noPrize);
      return false;
    }

    confirm({
      title: Lang.history.withdrawConfirmation,
      content: `${totalPrize} WAN`,
      onOk: () => {
        this.withdrawPrize();
      },
      onCancel() {
      },
    });
  }

  confirmClaim = async () => {
    let closed = await lotteryClosed();
    if (closed) {
      return;
    }

    const { totalPrize } = this.state;
    if (totalPrize === 0) {
      message.warning(Lang.history.noPrize);
      return false;
    }
    this.withdrawPrize();
  }

  withdrawPrize = async () => {
    const { selectedAccount, selectedWallet } = this.props;
    const encoded = await lotterySC.methods.prizeWithdraw().encodeABI();
    const address = selectedAccount ? selectedAccount.get('address') : null;
    const value = 0;
    let params = {
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x3B9ACA00",
      gasLimit: "0x989680", // 10,000,000
    };

    if (selectedWallet.type() == "EXTENSION") {
      params.gas = await this.estimateSendGas2(value, address);
    } else {
      params.gasLimit = await this.estimateSendGas2(value, address);
    }

    if (params.gasLimit == -1) {
      alertAntd(Lang.history.estimateGasError);
      return false;
    }

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      watchTransactionStatus(transactionID, (ret) => {
        console.log('ret:', ret);
        if (ret) {
          alertAntd(Lang.history.widhdrawSuccess);
          this.setStakerInfo();
        } else {
          alertAntd(Lang.history.widhdrawFailed);
        }
      });
      return transactionID;
    } catch (err) {
      console.log(err.message);
      alertAntd(err.message);
      return false;
    }
  }

  render() {
    const { selectedRowKeys, historyLoading, principalButtonLoading, historyList, raffleCount, totalStake, totalPrize, stakerInfoLoading } = this.state;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
      hideDefaultSelections: false,
      fixed: true,
    }
    return (
      <div className={style.normal}>

        <Spin spinning={stakerInfoLoading}>
          <Row className={style.block}>
            <Col span={8}>
              <p className={style.label}>Tickets You Have</p>
              <p className={style.value}>{raffleCount}</p>
            </Col>
            <Col span={8}>
              <p className={style.label}>Jack's Pot Stake</p>
              <p className={style.value}>{totalStake} WAN</p>
            </Col>
            <Col span={8}>
              <p className={style.label}>You Have Won:</p>
              <p className={`${style.value} ${style.totalPrize}`}>{keepOneDecimal(totalPrize)} WAN
                <Popconfirm
                  title={Lang.history.claimConfirmation}
                  onConfirm={this.confirmClaim}
                  okText="Yes"
                  cancelText="No"
                >
                  <span className={style.withdraw} >[ Claim ]</span>
                </Popconfirm>
              </p>
            </Col>
          </Row>
        </Spin>
        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>My Raffle Number</span>
          <div className={'guess-button ellipsoidalButton'} /* loading={principalButtonLoading} */ onClick={this.refundPrincipal}>Withdraw</div>
        </div>
        <div className={'table' + ' ' + style.table}>
          <Table rowSelection={rowSelection} columns={this.myDrawColumns} dataSource={historyList} loading={historyLoading} pagination={{ defaultCurrent: 1, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }} />
        </div>

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