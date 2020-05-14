import { connect } from "react-redux";
import React from 'react';
import { Component } from "../../components/base";
import { Row, Col, Divider, Table, message, Modal } from 'antd';
import SendModal from '../../components/SendModal';
import { EditableCell, EditableFormRow } from "../../components/EditableRow";
import { getSelectedAccount, WalletButton, WalletButtonLong, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import sleep from 'ko-sleep';
import { alertAntd, toUnitAmount, formatRaffleNumber } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../../utils/contract.js';
import { watchTransactionStatus } from '../../utils/common.js';
import { price } from '../../conf/config.js';

const { confirm } = Modal;

class IndexPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      n1: '',
      n2: '',
      n3: '',
      n4: '',
      machineCnt: '',
      selectedCodes: [],
      modalVisible: false,
      scrollY: 0
    };

    Date.prototype.format = function (fmt) {
      var o = {
        "M+": this.getMonth() + 1,                 //月份 
        "d+": this.getDate(),                    //日 
        "h+": this.getHours(),                   //小时 
        "m+": this.getMinutes(),                 //分 
        "s+": this.getSeconds(),                 //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds()             //毫秒 
      };
      if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
      }
      for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
          fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
      }
      return fmt;
    }
  }

  async componentDidMount() {
  }

  componentWillUnmount() {
  }

  columns = [
    {
      title: 'INDEX',
      dataIndex: 'key',
      key: 'key',
      align: 'center'
    },
    {
      title: 'NUMBER',
      dataIndex: 'code',
      key: 'code',
      align: 'center',
      render: text => {
        let arr = text.split('');
        arr = arr.map((s, i) => (<span key={i} className={i % 2 === 0 ? 'blueCircle' : 'redCircle'}>{s}</span>));
        return <span key={text}>{arr}</span>
      }
    },
    {
      title: 'DRAWS',
      dataIndex: 'times',
      key: 'times',
      editable: true,
      align: 'center',
      width: 200
    },
    {
      title: 'AMOUNT',
      dataIndex: 'price',
      key: 'price',
      render: text => (<span className={'price'}>{text} WAN</span>)
    },
    {
      title: 'ACTION',
      dataIndex: 'action',
      key: 'action',
      render: (text, record) => {
        return (
          <span>
            <a className={style.deleteAction} onClick={() => {this.deleteOne(record)}}>Delete</a>
          </span>
        );
      }
    },
  ]

  deleteOne = (record) => {
    const selectedCodes = [...this.state.selectedCodes];
    this.setState({ selectedCodes: selectedCodes.filter(item => item.key !== record.key) });
  }

  getDataWait = async (dataFunc) => {
    let max = 60;
    let i = 0;
    while (i < max) {
      if (dataFunc()) {
        return dataFunc();
      }
      await sleep(1000);
      i++;
    }
    return undefined
  }

  estimateSendGas = async (value, selectUp, address) => {
    try {
      let ret = await lotterySC.methods.buy(...selectUp).estimateGas({ gas: 10000000, value, from: address });
      if (ret == 10000000) {
        return -1;
      }
      return '0x' + (ret + 30000).toString(16);
    } catch (err) {
      console.log(err);
      return -1;
    }
  }

  sendTransaction = async (amount, selectUp) => {
    const { selectedAccount, selectedWallet, wanBalance } = this.props;
    const address = selectedAccount ? selectedAccount.get('address') : null;
    selectUp[1] = selectUp[1].map(v => web3.utils.toWei(v.toString()));
    console.log('wanBalance:', wanBalance);

    if (wanBalance <= amount) {
      alertAntd('Out of balance.');
      return false;
    }

    if (!address || address.length < 20) {
      alertAntd('Please select a wallet address first.');
      return false
    }

    const value = web3.utils.toWei(amount.toString());
    const encoded = await lotterySC.methods.buy(...selectUp).encodeABI();
    const params = {
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x3B9ACA00",
      gasLimit: "0x989680", // 10,000,000
    };

    if (selectedWallet.type() == "EXTENSION") {
      params.gas = await this.estimateSendGas(value, selectUp, address);
    } else {
      params.gasLimit = await this.estimateSendGas(value, selectUp, address);
      // params.gasPrice = "0x2540BE400";
    }

    if (params.gasLimit == -1) {
      alertAntd('Estimate Gas Error. Maybe out of time range.');
      return false;
    }

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      // console.log('Tx ID:', transactionID);
      watchTransactionStatus(transactionID, (ret) => {
        console.log('status:', ret)
        if (ret) {
          alertAntd('Success');
          this.setState({
            selectedCodes: []
          });
        } else {
          alertAntd('Failed');
        }
        this.hideModal();
      });
      return transactionID;
    } catch (err) {
      console.log(err);
      alertAntd(err);
      return false;
    }
  }

  showGameRule = () => {
    window.open("https://github.com/wandevs/wan-game/blob/master/GameRule.md");
  }

  onChangeCode = (index, value) => {
    if (value < 10) {
      switch (index) {
        case 1:
          this.setState({ n1: value });
          break;
        case 2:
          this.setState({ n2: value });
          break;
        case 3:
          this.setState({ n3: value });
          break;
        case 4:
          this.setState({ n4: value });
          break;
        default:
          break;
      }
    }
  }

  selfAdd = async () => {
    if (this.props.selectedAccount == null) {
      message.info("The page is not ready, please try later.");
      return false;
    }

    const { selectedCodes, n1, n2, n3, n4 } = this.state;
    const code = Number(n1).toFixed(0) + Number(n2).toFixed(0) + Number(n3).toFixed(0) + Number(n4).toFixed(0);

    for (let i = 0; i < selectedCodes.length; i++) {
      if (selectedCodes[i].code === code) {
        message.info("The same raffle number already exists, please modify it directly in the table.");
        return;
      }
    }

    if (!(await this.checkRaffleCount([code]))) {
      message.info("The count of Raffle number should not over 50.");
      return false;
    }

    let value = {
      key: selectedCodes.length + 1,
      code,
      times: 1,
      price: price,
    }

    let data = selectedCodes.slice();
    data.push(value);
    this.setState({ selectedCodes: data });
    document.getElementById('selectedNumberTable').scrollIntoView({
      block: 'center'
    });
  }

  randomAdd = async () => {
    if (this.props.selectedAccount == null) {
      message.info("The page is not ready, please try later.");
      return false;
    }

    let cnt = Number(this.state.machineCnt);
    if (cnt > 50 || cnt < 0) {
      message.info("The count of number is invalid.");
      return false;
    }
    const { selectedCodes } = this.state;

    if (cnt < 1) {
      message.warn("Count must >= 1");
      return;
    }

    if ((cnt + selectedCodes.length) >= 50) {
      cnt = 50 - selectedCodes.length;
    }

    let codes = [];
    for (; codes.length < cnt;) {
      let r = Math.floor(Math.random() * 9999) + 1; //get a four number random code.
      while (codes.includes(r)) {
        r = Math.floor(Math.random() * 9999) + 1;
      }
      codes.push(formatRaffleNumber(r));
    }

    if (!(await this.checkRaffleCount(codes))) {
      message.info("The count of Raffle number should not over 50.");
      return false;
    }

    let data = selectedCodes.slice();
    for (let i = 0; i < cnt; i++) {
      const value = {
        key: data.length + 1,
        code: codes[i],
        times: 1,
        price: price,
      }
      data.push(value);
    }
    this.setState({ selectedCodes: data });
    document.getElementById('selectedNumberTable').scrollIntoView({
      block: 'center'
    });
  }

  checkRaffleCount = async (selected) => {
    const { selectedCodes } = this.state;
    const data = await this.getHistoryData();
    let s = new Set();
    let allCodes = data.codes.concat(selected, selectedCodes.map(v => v.code));
    allCodes.forEach(v => {
      s.add(parseInt(v).toString());
    });
    return s.size > 50 ? false : true;
  }

  getHistoryData = async () => {

    let address = this.props.selectedAccount.get('address');
    let ret = await lotterySC.methods.getUserCodeList(address).call();
    return {
      amounts: ret.amounts,
      codes: ret.codes
    };
  }

  hideModal = () => {
    this.setState({ modalVisible: false });
    window.scrollTo(0, this.state.scrollY);
  }

  onConfirm = () => {
    const Y = window.scrollY;
    if (this.state.selectedCodes.length === 0) {
      return false;
    }
    this.setState({ modalVisible: true, scrollY: Y });
    window.scrollTo(0, 0);
  }

  clearRaffleNumber = () => {
    if (this.state.selectedCodes.length === 0) {
      return false;
    }

    confirm({
      title: 'Do you Want to clear all raffle number?',
      content: 'Clear confirm.',
      onOk: () => {
        this.setState({ selectedCodes: [] });
      },
      onCancel() {
      },
    });
  }

  handleSave = row => {
    console.log('row:', row);
    const newData = [...this.state.selectedCodes];
    const index = newData.findIndex(item => row.key === item.key);
    const item = newData[index];
    row.price = price * row.times;
    newData.splice(index, 1, { ...item, ...row });
    this.setState({
      selectedCodes: newData,
    });
  }

  render() {
    const components = {
      body: {
        row: EditableFormRow,
        cell: EditableCell,
      },
    };
    const columns = this.columns.map(col => {
      if (!col.editable) {
        return col;
      }
      return {
        ...col,
        onCell: record => ({
          record,
          editable: col.editable,
          dataIndex: col.dataIndex,
          title: col.title,
          handleSave: this.handleSave,
        }),
      };
    });

    return (
      <div className={style.app}>
        <div id="entryArea" className={style.guessNumber} >
          <div className={style.leftWing}>
            <img src={require('../../static/images/ear1.png')} />
          </div>
          <div className={style.centerContainer}>
            <div className={style.normal}>
              <p><span className={style.highlight}>Self Selection</span></p>
              <div className={style['input-wrap']}>
                <input type="number" min='0' max='9' placeholder="0 - 9" value={this.state.n1} onChange={e => this.onChangeCode(1, e.target.value)} />
                <input type="number" min='0' max='9' placeholder="0 - 9" value={this.state.n2} onChange={e => this.onChangeCode(2, e.target.value)} />
                <input type="number" min='0' max='9' placeholder="0 - 9" value={this.state.n3} onChange={e => this.onChangeCode(3, e.target.value)} />
                <input type="number" min='0' max='9' placeholder="0 - 9" value={this.state.n4} onChange={e => this.onChangeCode(4, e.target.value)} />
                <div className={'guess-button yellowButton'} onClick={this.selfAdd}>ADD</div>
              </div>
            </div>
            <div className={style.normal}>
              <p><span className={style.highlight}>Machine Selection</span></p>
              <input className={style.randomInput} type="number" min='1' max='50' placeholder="1 - 50" value={this.state.machineCnt} onChange={e => { if (e.target.value <= 50) { this.setState({ machineCnt: e.target.value }) } }} />
              <div className={'guess-button greenButton'} onClick={this.randomAdd}>ADD</div>
            </div>
          </div>
          <div className={style.rightWing}>
            <img src={require('../../static/images/ear2.png')} />
          </div>
        </div>

        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>Selected Number</span>
        </div>

        <div className={'table'} id="selectedNumberTable">
          <Table
            components={components}
            columns={columns}
            rowClassName={() => 'editable-row'}
            bordered={false}
            dataSource={this.state.selectedCodes} />
          <div className={style['centerLine']}>
            <div className={'guess-button ellipsoidalButton'} onClick={this.onConfirm}>Buy</div>
            <div className={'guess-button ellipsoidalButton'} onClick={this.clearRaffleNumber}>Clear</div>
          </div>
        </div>

        {
          this.state.modalVisible && <SendModal
            sendTransaction={this.sendTransaction}
            watchTransactionStatus={watchTransactionStatus}
            hideModal={this.hideModal}
            data={this.state.selectedCodes}
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
})(IndexPage);
