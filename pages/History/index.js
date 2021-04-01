import { connect } from "react-redux";
import React from 'react';
import { Table, Row, Col, message, Spin, Modal, Input } from 'antd';
import style from './index.less';
import { Component } from '../../components/base';
import sleep from 'ko-sleep';
import BigNumber from 'bignumber.js';
import RefundPrincipalModal from '../../components/RefundPrincipalModal';
import { alertAntd, toUnitAmount, formatRaffleNumber, keepOneDecimal } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr, lotteryClosed } from '../../utils/contract.js';
import { getNodeUrl, isSwitchFinish, getWeb3 } from '../../conf/web3switch.js';

import { watchTransactionStatus } from '../../utils/common.js';
import { price } from '../../conf/config.js';
import Lang from '../../conf/language.js';

const { confirm } = Modal;
const { Search } = Input;

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
      totalPrize: '0',
      showClaim: false,
      ticketFilter: false,
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
      className: 'raffle_number',
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
      title: "VALUE",
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
    while (!this.props.wallet.connected) {
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

  componentDidUpdate(pre) {
    if (!pre.wallet) {
      return;
    }
    let preAddr = pre.wallet.address;
    if (this.props.wallet.address) {
      let currentAddr = this.props.wallet.address;
      if (preAddr !== currentAddr) {
        this.resetData();
      }
    }
  }

  setStakerInfo = async () => {
    let address = this.props.wallet.address;
    let { prize, codeCount } = await lotterySC().methods.userInfoMap(address).call();
    let pending = await lotterySC().methods.isUserPrizeWithdrawPending(address).call();
    const totalPrize = toUnitAmount(parseInt(prize), 18).toString();
    this.setState({
      totalPrize: totalPrize,
      raffleCount: parseInt(codeCount),
      showClaim: !pending && totalPrize !== '0'
    });
  }

  resetData = async () => {
    let address = this.props.wallet.address;
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
    let ret = await lotterySC().methods.getUserCodeList(address).call();
    let { amounts, codes, exits } = ret;
    let data = amounts.map((v, i) => ({
      key: i + 1,
      code: codes[i],
      times: getWeb3().utils.fromWei(v) / price,
      from: address,
      price: getWeb3().utils.fromWei(v),
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
    const codes = selectedRows.map(v => Number(v.code));
    const encoded = await lotterySC().methods.redeem(codes).encodeABI();
    const address = this.props.wallet.address;

    if (codes.length === 0) {
      message.warn(Lang.history.selectRow);
      return false
    }

    if (!address || address.length < 20) {
      message.warn(Lang.history.selectAddress);
      return false
    }

    this.setState({
      principalButtonLoading: true,
      historyLoading: true,
      stakerInfoLoading: true,
    });

    const value = 0;
    let params = {
      from: address,
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x3B9ACA00",
      gasLimit: "0x989680", // 10,000,000
    };

    if (!window.injectWeb3) {
      params.gas = await this.estimateSendGas(value, codes, address);
    } else {
      params.gasLimit = await this.estimateSendGas(value, codes, address);
    }

    if (params.gasLimit == -1) {
      message.error(Lang.history.estimateGasError);
      return false;
    }

    // console.log('params:', params);

    try {
      this.props.wallet.web3.eth.sendTransaction(params, (err, transactionID)=>{
        console.log('transactionID', transactionID);
        watchTransactionStatus(transactionID, this.props.wallet.web3, async (ret) => {
          if (ret) {
            alertAntd(Lang.history.redeemSuccess);
          } else {
            message.error(Lang.history.redeemFailed);
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
      });
      return true;
    } catch (err) {
      message.error(err.message);
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
      let ret = await lotterySC().methods.redeem(selectUp).estimateGas({ gas: 10000000, value, from: address });
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
      let ret = await lotterySC().methods.prizeWithdraw().estimateGas({ gas: 10000000, value, from: address });
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
    if (totalPrize === '0') {
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
    if (totalPrize === '0') {
      message.warning(Lang.history.noPrize);
      return false;
    }

    confirm({
      title: Lang.history.claimConfirmation,
      content: '',
      className: 'confirmModal',
      onOk: () => {
        this.withdrawPrize();
      }
    });
  }

  withdrawPrize = async () => {
    const encoded = await lotterySC().methods.prizeWithdraw().encodeABI();
    const address = this.props.wallet.address;
    const value = 0;
    let params = {
      from: address,
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x3B9ACA00",
      gasLimit: "0x989680", // 10,000,000
    };

    if (!window.injectWeb3) {
      params.gas = await this.estimateSendGas2(value, address);
    } else {
      params.gasLimit = await this.estimateSendGas2(value, address);
    }

    if (params.gasLimit == -1) {
      message.error(Lang.history.estimateGasError);
      return false;
    }

    try {
      this.props.wallet.web3.eth.sendTransaction(params, (err, transactionID)=>{
        console.log('transactionID', transactionID);
        watchTransactionStatus(transactionID, this.props.wallet.web3, (ret) => {
          if (ret) {
            alertAntd(Lang.history.widhdrawSuccess);
            this.setStakerInfo();
          } else {
            message.error(Lang.history.widhdrawFailed);
          }
        });
      });
      return true;
    } catch (err) {
      // console.log(err.message);
      message.error(err.message);
      return false;
    }
  }

  onSearch = (v) => {
    this.setState({
      ticketFilter: v.trim().length > 0 ? v : false
    })
  }

  onChange = (e) => {
    let value = e.target.value;
    this.setState({
      ticketFilter: value.trim().length > 0 ? value : false
    });
  }

  render() {
    const { selectedRowKeys, historyLoading, historyList, raffleCount, totalStake, totalPrize, stakerInfoLoading, showClaim, ticketFilter } = this.state;
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
      hideDefaultSelections: false,
      fixed: true,
    }
    let data = [];
    if (ticketFilter) {
      for (let i = 0; i < historyList.length; i++) {
        let item = historyList[i];
        if (formatRaffleNumber(item.code).indexOf(ticketFilter) !== -1) {
          data.push(item);
        }
      }
    } else {
      data = historyList;
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
                {
                  showClaim && <span className={style.withdraw} onClick={this.confirmClaim}>[&nbsp;CLAIM&nbsp;]</span>
                }
              </p>
            </Col>
          </Row>
        </Spin>
        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>My Raffle Number</span>
          <div className={style['searchTicket']}>
            <Search placeholder="Search by ticket" enterButton size="default" style={{ width: 300 }} onSearch={this.onSearch} onChange={this.onChange} allowClear={true} />
          </div>
          <div className={'guess-button ellipsoidalButton'} onClick={this.refundPrincipal}>Withdraw</div>
        </div>
        <div className={'table' + ' ' + style.table}>
          <Table rowSelection={rowSelection} columns={this.myDrawColumns} dataSource={data} loading={historyLoading} pagination={{ defaultCurrent: 1, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], position: 'top' }} />
        </div>

        {
          this.state.modalVisible && <RefundPrincipalModal
            sendTransaction={this.sendRefundPrincipalTx}
            hideModal={this.hideModal}
            data={this.state.selectedRows}
            account={this.props.wallet.address}
            />
        }
      </div>
    );
  }
}

export default History;