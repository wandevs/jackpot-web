import { Component } from "react";
import { Modal, Form, Input, Icon, Table } from 'antd';
import style from './style.less';
import { alertAntd } from '../../utils/utils.js';
import Lang from '../../conf/language.js';

class SendModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmLoading: false,
    };

    const { data } = this.props;
    console.log('data:', data)
    let selections = data.filter(v => v.times > 0);
    this.codes = selections.map(v => v.code);
    this.amount = 0;
    this.amounts = selections.map(v => {
      this.amount += v.price;
      return v.price;
    });
  }

  componentDidMount() {
  }

  componentWillUnmount() {
  }

  columns = [
    {
      title: 'INDEX',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: 'NUMBER',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'DRAWS',
      dataIndex: 'times',
      key: 'times',
      editable: true,
    },
    {
      title: 'VALUE (WAN)',
      dataIndex: 'price',
      key: 'price',
    },
  ]

  okCallback = (ret) => {
    this.setState({
      confirmLoading: false,
    });

    if (ret) {
      alertAntd(Lang.sendModal.txSuccess);
      /* if (ret) {
        this.props.hideModal();
      } */
    } else {
      alertAntd(Lang.sendModal.txFailed);
    }
  }

  handleOk = async (e) => {
    e.preventDefault();
    alertAntd("Sorry, out of service. we will come back soon.");
    return;
    this.setState({
      confirmLoading: true,
    });
    let ret = await this.props.sendTransaction(this.amount, [this.codes, this.amounts]);
    if (ret) {
      this.props.watchTransactionStatus(ret, this.okCallback)
    } else {
      this.okCallback(false);
    }
  };

  handleCancel = () => {
    this.props.hideModal();
  };

  render() {
    const { confirmLoading } = this.state;
    const { data, WalletButton } = this.props;
    return (
      <div>
        <Modal
          title={"Transaction for Jack's Pot"}
          wrapClassName={style['sendModal']}
          visible={true}
          onOk={this.handleOk}
          confirmLoading={confirmLoading}
          onCancel={this.handleCancel}
        >
          <Form layout={'vertical'}>
            <Form.Item label="From Address:">
              <WalletButton />
            </Form.Item>
          </Form>
          <div className={style['totalContainer']}><span className={style.label}>Total Cost: </span><span className={style.value}>{this.amount.toString()} WAN</span></div>
          <Table
            className={style['selectedRaffleList']}
            columns={this.columns}
            bordered={false}
            pagination={false}
            dataSource={data} />
          <div style={{ color: '#880' }}>* We will use the lowest gas charge by default, around 0.0002~0.03 WAN.</div>
        </Modal>
      </div>
    );
  }
}

export default SendModal;
