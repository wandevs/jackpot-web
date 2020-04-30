import { connect } from "react-redux";
import React from 'react';
import { Component } from "../components/base";
import { Row, Col, Divider, Table, message, Modal } from 'antd';
import { Link } from 'umi';
import SendModal from '../components/SendModal';
import { EditableCell, EditableFormRow } from "../components/EditableRow";

import { getSelectedAccount, WalletButton, WalletButtonLong, getSelectedAccountWallet, getTransactionReceipt } from "wan-dex-sdk-wallet";
import "wan-dex-sdk-wallet/index.css";
import style from './style.less';
import sleep from 'ko-sleep';
import { alertAntd, toUnitAmount } from '../utils/utils.js';
import { web3, lotterySC, lotterySCAddr } from '../utils/contract.js';
import { price } from '../conf/config.js';

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
      title: 'Index',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: 'Raffle Number',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Multiple of Draws',
      dataIndex: 'times',
      key: 'times',
      editable: true,
    },
    {
      title: 'Price (WAN)',
      dataIndex: 'price',
      key: 'price',
    },
  ]

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

  watchTransactionStatus = (txID, callback) => {
    const getTransactionStatus = async () => {
      const tx = await getTransactionReceipt(txID);
      if (!tx) {
        setTimeout(() => getTransactionStatus(txID), 3000);
      } else if (callback) {
        callback(Number(tx.status) === 1);
      } else {
        alertAntd('success');
      }
    };
    setTimeout(() => getTransactionStatus(txID), 3000);
  };

  estimateSendGas = async (value, selectUp, address) => {
    try {
      let ret = await lotterySC.methods.buy(...selectUp).estimateGas({ gas: 10000000, value, from: address });
      console.log('=------es-----=:', ret);
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
    let encoded = await lotterySC.methods.buy(...selectUp).encodeABI();
    console.log('encoded:', encoded);
    let params = {
      to: lotterySCAddr,
      data: encoded,
      value,
      gasPrice: "0x29E8D60800",
      gasLimit: "0x989680", // 10,000,000
    };

    if (selectedWallet.type() == "EXTENSION") {
      params.gas = await this.estimateSendGas(value, selectUp, address);
    } else {
      params.gasLimit = await this.estimateSendGas(value, selectUp, address);
      // params.gasPrice = "0x2540BE400";
    }

    console.log('gasLimit:', params.gasLimit);

    if (params.gasLimit == -1) {
      alertAntd('Estimate Gas Error. Maybe out of time range.');
      return false;
    }

    try {
      let transactionID = await selectedWallet.sendTransaction(params);
      console.log('transactionID:', transactionID);
      this.watchTransactionStatus(transactionID, (ret) => {
        console.log('status:', ret)
        if (ret) {
          console.log('watch tx status');
          alertAntd('Success');
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

  selfAdd = () => {
    if (this.state.selectedCodes.length >= 50) {
      message.warn("Max support add 50 raffle number once.");
      return;
    }

    let code = Number(this.state.n1).toFixed(0) + Number(this.state.n2).toFixed(0) + Number(this.state.n3).toFixed(0) + Number(this.state.n4).toFixed(0);


    for (let i = 0; i < this.state.selectedCodes.length; i++) {
      if (this.state.selectedCodes[i].code === code) {
        message.info("The same raffle number already exists, please modify it directly in the table.");
        return;
      }
    }

    let value = {
      key: this.state.selectedCodes.length + 1,
      code,
      times: 1,
      price: price,
    }

    let data = this.state.selectedCodes.slice();
    data.push(value);
    this.setState({ selectedCodes: data });
  }

  randomAdd = () => {
    let cnt = Number(this.state.machineCnt);

    if (cnt < 1) {
      message.warn("Count must >= 1");
      return;
    }
    if ((cnt + this.state.selectedCodes.length) >= 50) {
      cnt = 50 - this.state.selectedCodes.length;
    }

    let codes = [];
    for (; codes.length < cnt;) {
      let r = Math.random().toFixed(4).substr(2); //get a four number random code.
      if (!codes.includes(r)) {
        codes.push(r);
      }
    }

    let data = this.state.selectedCodes.slice();
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
  }

  clearRaffleNumber = () => {
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

  hideModal = () => {
    window.scrollTo(0, this.pageYOffset);
    this.setState({ modalVisible: false });
  }

  onConfirm = () => {
    this.pageYOffset = window.scrollY;
    // window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    this.setState({ modalVisible: true });
    // console.log('datas:', this.state.selectedCodes);
  }

  handleSave = row => {
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
        <div className={style.title5}>
          Entry Area
        </div>
        <div>
          <Link to="/history">View Past Draw Results</Link>
        </div>
        <div id="entryArea" className={style.guessNumber} >
          <Row>
            <Col span={6}>
              <div style={{ lineHeight: "100px" }}>Self Selection:</div>
            </Col>
            <Col span={12}>
              <div className={style.normal}>
                <p></p>
                <p>Fill in a four digits' number in the box below, e.g.6666</p>
                <div className={style['input-wrap']}>
                  <input type="number" min='0' max='9' placeholder="0~9" value={this.state.n1} onChange={e => this.onChangeCode(1, e.target.value)} />
                  <input type="number" min='0' max='9' placeholder="0~9" value={this.state.n2} onChange={e => this.onChangeCode(2, e.target.value)} />
                  <input type="number" min='0' max='9' placeholder="0~9" value={this.state.n3} onChange={e => this.onChangeCode(3, e.target.value)} />
                  <input type="number" min='0' max='9' placeholder="0~9" value={this.state.n4} onChange={e => this.onChangeCode(4, e.target.value)} />
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.selfAdd}>Add</div>
            </Col>
          </Row>
          <Row>
            <Divider />
          </Row>
          <Row>
            <Col span={6}>
              <div style={{ lineHeight: "100px" }}>Machine Selection:</div>
            </Col>
            <Col span={12}>
              <Row>
                <div className={style.normal}>
                  <p>Enter the number of bets you want to make</p>
                  <input style={{ width: "400px" }} type="number" min='1' max='50' placeholder="1~50" value={this.state.machineCnt} onChange={e => { if (e.target.value <= 50) { this.setState({ machineCnt: e.target.value }) } }} />
                </div>
              </Row>
            </Col>
            <Col span={6}>
              <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.randomAdd}>Add</div>
            </Col>
          </Row>
        </div>
        <div style={{ height: "50px" }}>
          <Link to="/history">View My Draw History</Link>
        </div>

        <div className={style['table']}>
          <div style={{ height: "20px" }}></div>
          <h1>Your Raffle Number:</h1>
          <Table
            components={components}
            columns={columns}
            rowClassName={() => 'editable-row'}
            bordered
            dataSource={this.state.selectedCodes} />
          <div className={style.centerLine}>
            <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.onConfirm}>Confirm</div>
            <div className={[style['guess-button'], style.yellowButton].join(' ')} onClick={this.clearRaffleNumber}>Clear</div>
          </div>
          <div style={{ height: "30px" }}></div>
        </div>

        <div style={{ height: "50px" }}></div>
        <div className={style['table']}>
          <div style={{ height: "20px" }}></div>
          <h1>Game Rules</h1>
          <div>
            <p>Jack’s Pot is a no-loss lottery game built on Wanchain which draws from the design of the Ethereum based PoolTogether game while introducing novel game mechanics.</p>
            <p>To play the game, participants deposit WAN while also guessing a number between 1 and 4 inclusive.</p>
            <p>Participants' WAN deposits are delegated to POS verification nodes, and the accrued consensus rewards are pooled into a prize pot.</p>
            <p>Every Friday a winning number is selected at random using Wanchain’s true random number generation, and the reward will be awarded proportionally to participants who guessed the winning number.</p>
            <p>If there is no winner, the prize pot will automatically accumulate to the next cycle.</p>
          </div>
          <div style={{ height: "30px" }}></div>

        </div>
        <div style={{ height: "50px" }}></div>
        <div style={{ height: "50px" }}></div>
        {
          this.state.modalVisible && <SendModal
            sendTransaction={this.sendTransaction}
            watchTransactionStatus={this.watchTransactionStatus}
            hideModal={this.hideModal}
            data={this.state.selectedCodes}
            type={'up'}
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
