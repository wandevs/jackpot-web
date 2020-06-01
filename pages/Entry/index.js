import { connect } from "react-redux";
import React from 'react';
import { Component } from "../../components/base";
import { Table, message, Modal, Tooltip } from 'antd';
import SendModal from '../../components/SendModal';
import { EditableCell, EditableFormRow } from "../../components/EditableRow";
import { getSelectedAccount, WalletButton, WalletButtonLong, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './index.less';
import sleep from 'ko-sleep';
import { alertAntd, toUnitAmount, formatRaffleNumber } from '../../utils/utils.js';
import { web3, lotterySC, lotterySCAddr, lotteryClosed } from '../../utils/contract.js';
import { watchTransactionStatus } from '../../utils/common.js';
import { price } from '../../conf/config.js';
import Lang from '../../conf/language.js';

const { confirm } = Modal;
const prefix = 'jackpot';

class IndexPage extends Component {
  constructor(props) {
    super(props);
    let localList = window.localStorage.getItem(`${prefix}_selectionList`);
    this.state = {
      n1: '',
      n2: '',
      n3: '',
      n4: '',
      machineCnt: '',
      selectedCodes: localList ? JSON.parse(localList) : [],
      modalVisible: false,
      scrollY: 0,
      selfAdd_loading: false,
      machineAdd_loading: false,
      placeholder: '',
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
    let timer = 0;
    while (this.props.selectedAccount === null) {
      if (timer > 10) {
        message.info(Lang.history.accountUnfounded);
        return false;
      }
      await sleep(500);
      timer++;
    }
    this.resetPlaceHolder();
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
      title: 'VALUE',
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
            <button className={style.deleteAction} onClick={() => { this.deleteOne(record) }}>Delete</button>
          </span>
        );
      }
    },
  ]

  deleteOne = (record) => {
    const selectedCodes = [...this.state.selectedCodes];
    let arr = selectedCodes.filter(item => item.code !== record.code);
    this.setState({ selectedCodes: arr }, this.resetPlaceHolder);
    window.localStorage.setItem(`${prefix}_selectionList`, JSON.stringify(arr));
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
    if (wanBalance <= amount) {
      alertAntd(Lang.entry.outOfBalance);
      return false;
    }

    if (!address || address.length < 20) {
      alertAntd(Lang.entry.selectAddress);
      return false
    }

    const history = await this.getHistoryData();
    for (let i = 0; i < history.codes.length; i++) {
      if (selectUp[0].includes(history.codes[i]) && history.exits[i] === '1') {
        message.warning(Lang.entry.exitingNumber);
        return;
      }
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
      alertAntd(Lang.entry.estimateError);
      return false;
    }

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      // console.log('Tx ID:', transactionID);
      watchTransactionStatus(transactionID, (ret) => {
        if (ret) {
          this.setState({
            selectedCodes: []
          });
          window.localStorage.removeItem(`${prefix}_selectionList`);
          this.resetPlaceHolder();
        } else {
          alertAntd(Lang.entry.failed);
        }
        this.setState({ modalVisible: false });
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

  onChangeCode = (index, value, e) => {
    if (value.length > 1) {
      value = value.substr(-1);
    }

    let t = /^[0-9]$/g.test(value) || value === '';
    this.setState({
      [`n${index}`]: t ? value : ''
    });

    if (t && value !== '' && index !== 4) { // Auto jump to next input filed.
      document.getElementById('selfSelectNumberGroup').querySelectorAll(`input`)[index].focus();
      e.preventDefault();
    }
  }

  onKeyDown = (index, e) => {
    if (e.target.value === '' && e.keyCode === 8 && index !== 1) {
      setTimeout(() => {
        document.getElementById('selfSelectNumberGroup').querySelectorAll(`input`)[index - 2].focus();
      }, 0);
    }
  }

  onChangeMachineCode = e => {
    let value = e.target.value;
    let reg = /^([1-9]{1}|[1-4]{1}[0-9]{1}|(50){1})$/g;
    this.setState({ machineCnt: (value === '' || reg.test(value)) ? value : '' });
  }

  selfAdd = async () => {
    this.setState({ selfAdd_loading: true });
    let closed = await lotteryClosed();
    if (closed) {
      this.setState({ selfAdd_loading: false });
      return;
    }

    if (this.props.selectedAccount == null) {
      message.warning(Lang.entry.notReady);
      this.setState({ selfAdd_loading: false });
      return false;
    }

    const { selectedCodes, n1, n2, n3, n4 } = this.state;
    if (!(n1 && n2 && n3 && n4)) {
      message.warning(Lang.entry.numberRequired);
      this.setState({ selfAdd_loading: false });
      return;
    }
    const code = Number(n1).toFixed(0) + Number(n2).toFixed(0) + Number(n3).toFixed(0) + Number(n4).toFixed(0);
    for (let i = 0; i < selectedCodes.length; i++) {
      if (selectedCodes[i].code === code) {
        message.warning(Lang.entry.sameNumberExist);
        this.setState({ selfAdd_loading: false });
        return;
      }
    }
    if (!(await this.checkRaffleCount([code]))) {
      message.warning(Lang.entry.raffleOverflow);
      this.setState({ selfAdd_loading: false });
      return false;
    }
    let value = {
      key: selectedCodes.length + 1,
      code,
      times: 1,
      price: price,
    }
    let data = selectedCodes.slice();
    data.unshift(value);
    this.setState({ selectedCodes: data, selfAdd_loading: false });
    window.localStorage.setItem(`${prefix}_selectionList`, JSON.stringify(data));
    document.getElementsByClassName('title')[0].scrollIntoView({
      block: 'center'
    });
    this.resetPlaceHolder();
  }

  randomAdd = async () => {
    this.setState({ machineAdd_loading: true });
    let closed = await lotteryClosed();
    if (closed) {
      this.setState({ machineAdd_loading: false });
      return;
    }

    const { selectedCodes, machineCnt } = this.state;

    if (this.props.selectedAccount == null) {
      message.warning(Lang.entry.notReady);
      this.setState({ machineAdd_loading: false });
      return false;
    }

    let cnt = Number(machineCnt);
    if (cnt > 50 || cnt < 1) {
      message.warning(Lang.entry.invalidNumber);
      this.setState({ machineAdd_loading: false });
      return false;
    }

    if (cnt < 1) {
      message.warn("Count must >= 1");
      this.setState({ machineAdd_loading: false });
      return;
    }

    if ((cnt + selectedCodes.length) >= 50) {
      cnt = 50 - selectedCodes.length;
      if (cnt <= 0) {
        message.warning(Lang.entry.raffleOverflow);
        return false;
      }
    }

    const history = await this.getHistoryData();
    const selected = selectedCodes.map(v => v.code);
    let codes = [];
    for (; codes.length < cnt;) {
      let r = formatRaffleNumber(Math.floor(Math.random() * 9999) + 1);
      while (codes.includes(r) || selected.includes(formatRaffleNumber(r)) || history.codes.includes(r)) {
        r = formatRaffleNumber(Math.floor(Math.random() * 9999) + 1);
      }
      codes.push(r);
    }

    if (!(await this.checkRaffleCount(codes))) {
      message.warning(Lang.entry.raffleOverflow);
      this.setState({ machineAdd_loading: false });
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
      data.unshift(value);
    }
    this.setState({ selectedCodes: data, machineAdd_loading: false });
    window.localStorage.setItem(`${prefix}_selectionList`, JSON.stringify(data));
    document.getElementsByClassName('title')[0].scrollIntoView({
      block: 'center'
    });
    this.resetPlaceHolder();
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
      codes: ret.codes,
      exits: ret.exits,
    };
  }

  hideModal = () => {
    this.setState({ modalVisible: false });
    window.scrollTo(0, this.state.scrollY);
  }

  onConfirm = async () => {
    let closed = await lotteryClosed();
    if (closed) {
      return;
    }

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
      title: Lang.entry.clearAllRaffle,
      content: '',
      className: 'confirmModal',
      onOk: () => {
        this.setState({ selectedCodes: [] });
        window.localStorage.removeItem(`${prefix}_selectionList`);
        this.resetPlaceHolder();
      },
      onCancel() {
      },
    });
  }

  handleSave = row => {
    const newData = [...this.state.selectedCodes];
    const index = newData.findIndex(item => row.code === item.code);
    const item = newData[index];
    row.price = price * row.times;
    newData.splice(index, 1, { ...item, ...row });
    this.setState({
      selectedCodes: newData,
    });
    window.localStorage.setItem(`${prefix}_selectionList`, JSON.stringify(newData));
  }

  resetPlaceHolder = async () => {
    const { selectedCodes } = this.state;
    let address = this.props.selectedAccount.get('address');
    let ret = await lotterySC.methods.getUserCodeList(address).call();
    let { codes } = ret;
    const t = codes.length + selectedCodes.length;
    // console.log('t:', t);
    this.setState({
      placeholder: t < 49 ? `1 - ${50 -t}` : (t === 49 ? '1' : '0')
    });
  }

  render() {
    const { selfAdd_loading, machineAdd_loading, selectedCodes, modalVisible, placeholder } = this.state;
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
        })
      };
    });

    let data = selectedCodes.map((v, i) => {
      const { code, price, times } = v;
      return {
        key: i + 1,
        code,
        price,
        times
      }
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
              <div id="selfSelectNumberGroup" className={style['input-wrap']}>
                <input type="text" placeholder="0 - 9" value={this.state.n1} onChange={e => { this.onChangeCode(1, e.target.value, e) }} onKeyDown={e => this.onKeyDown(1, e)} />
                <input type="text" placeholder="0 - 9" value={this.state.n2} onChange={e => { this.onChangeCode(2, e.target.value, e) }} onKeyDown={e => this.onKeyDown(2, e)} />
                <input type="text" placeholder="0 - 9" value={this.state.n3} onChange={e => { this.onChangeCode(3, e.target.value, e) }} onKeyDown={e => this.onKeyDown(3, e)} />
                <input type="text" placeholder="0 - 9" value={this.state.n4} onChange={e => { this.onChangeCode(4, e.target.value, e) }} onKeyDown={e => this.onKeyDown(4, e)} />
                <button className={'guess-button yellowButton'} onClick={this.selfAdd} disabled={selfAdd_loading}>ADD</button>
              </div>
            </div>
            <div className={style.normal}>
              <p><span className={style.highlight}>Machine Selection</span></p>
              <Tooltip title="Enter a number of tickets you want the machine to select for you" placement="topRight">
                <input className={style.randomInput} placeholder={placeholder} value={this.state.machineCnt} onChange={this.onChangeMachineCode} />
              </Tooltip>
              <button className={'guess-button greenButton'} onClick={this.randomAdd} disabled={machineAdd_loading}>ADD</button>
            </div>
          </div>
          <div className={style.rightWing}>
            <img src={require('../../static/images/ear2.png')} />
          </div>
        </div>

        <div className={'title'}>
          <img src={require('../../static/images/coupon.png')} />
          <span>Ticket Selection</span>
        </div>

        <div className={'table'} id="selectedNumberTable">
          <Table
            components={components}
            columns={columns}
            rowClassName={() => 'editable-row'}
            bordered={false}
            dataSource={data} />
          <div className={style['centerLine']}>
            <div className={'guess-button ellipsoidalButton'} onClick={this.onConfirm}>Stake</div>
            <div className={'guess-button ellipsoidalButton'} onClick={this.clearRaffleNumber}>Clear</div>
          </div>
        </div>

        {
          modalVisible && <SendModal
            sendTransaction={this.sendTransaction}
            watchTransactionStatus={watchTransactionStatus}
            hideModal={this.hideModal}
            data={data}
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
