import { Component } from "react";
import { Modal, Form, Input, Icon, Table } from 'antd';
import BigNumber from 'bignumber.js';
import style from './style.less';
import { alertAntd, formatRaffleNumber } from '../../utils/utils.js';

class RefundPrincipalModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmLoading: false,
    };

    const { data } = this.props;
    this.codes = data.map(v => v.code);
    this.amount = 0;
    data.forEach(v => {
      this.amount = new BigNumber(this.amount).plus(v.price).toString();
    });
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
      render: text => formatRaffleNumber(text)
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

  handleOk = (e) => {
    e.preventDefault();
    this.props.sendTransaction();
    this.handleCancel();
  };

  handleCancel = () => {
    this.props.hideModal();
  };

  render() {
    const { confirmLoading } = this.state;
    const { data, account } = this.props;
    return (
      <div>
        <Modal
          title={"Redeem"}
          wrapClassName={style['sendModal']}
          visible={true}
          onOk={this.handleOk}
          confirmLoading={confirmLoading}
          onCancel={this.handleCancel}
        >
          <Form layout={'vertical'}>
            <Form.Item label="To Address:">
              <Input className={style.account} placeholder="Account" value={account} disabled/>
            </Form.Item>
          </Form>
          <div className={style['totalContainer']}>Total Redeem: <span>{this.amount} WAN</span></div>
          <Table
            className={style['selectedRaffleList']}
            columns={this.columns}
            pagination={false}
            dataSource={data} />
        </Modal>
      </div>
    );
  }
}

export default RefundPrincipalModal;
