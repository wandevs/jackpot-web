import { Component } from "react";
import { Modal, Form, Input, Icon, Table } from 'antd';
import style from './style.less';
import { alertAntd } from '../../utils/utils.js';

class SendModalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ModalText: 'Content of the modal',
      confirmLoading: false,
    };

    const { data } = this.props;
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

  okCallback = (ret) => {
    this.setState({
      confirmLoading: false,
    });

    if (ret) {
      alertAntd('Transaction Success!');
      if (ret) {
        this.props.hideModal();
      }
    } else {
      alertAntd('Error: Transaction Failed!');
    }
  }

  handleOk = (e) => {
    e.preventDefault();
    this.props.form.validateFields(async (err, values) => {
      if (!err) {
        this.setState({
          confirmLoading: true,
        });

        console.log('codes:', this.codes, this.amounts, this.amount);
        console.log('amount: ', this.amount);
        let ret = await this.props.sendTransaction(this.amount, [this.codes, this.amounts]);
        console.log('ret: ', ret);

        if (ret) {
          this.props.watchTransactionStatus(ret, this.okCallback)
        } else {
          this.okCallback(false);
        }
      }
    });
  };

  handleCancel = () => {
    this.props.hideModal();
  };

  render() {
    const { confirmLoading, ModalText, fields } = this.state;
    const { data, WalletButton } = this.props;
    // const { getFieldDecorator, setFieldsValue } = this.props.form;
    console.log('data:', data)
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
          <div className={style['totalContainer']}>Total cost: {this.amount}</div>
          <Table
            className={style['selectedRaffleList']}
            columns={this.columns}
            bordered
            pagination={false}
            dataSource={data} />
          <div style={{ color: '#880' }}>* We will use the lowest gas charge by default, around 0.002~0.03 WAN.</div>
        </Modal>
      </div>
    );
  }
}

const SendModal = Form.create({ name: 'normal_login' })(SendModalForm);

export default SendModal;
