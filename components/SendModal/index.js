import { Component } from "react";
import { Modal, Form, Input, Icon } from 'antd';
import style from './style.less';

class SendModalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ModalText: 'Content of the modal',
      confirmLoading: false,
    };
    this.web3 = props.web3;
  }

  componentDidMount() {
  }

  componentWillUnmount() {
  }

  okCallback = (ret) => {
    this.setState({
      confirmLoading: false,
    });

    if (ret) {
      window.alertAntd('Transaction Success!');
      if (ret) {
        this.props.hideModal();
      }
    } else {
      window.alertAntd('Error: Transaction Failed!');
    }
  }

  handleOk = (e) => {
    e.preventDefault();
    this.props.form.validateFields((err, values) => {
      if (!err) {
        this.setState({
          confirmLoading: true,
        });
        setTimeout(async () => {
          let ret = await this.props.sendTransaction(values.amount);
          if (ret) {
            this.props.watchTransactionStatus(ret, this.okCallback)
          } else {
            this.okCallback(false);
          }
        }, 0);
      }
    });
  };

  handleCancel = () => {
    this.props.hideModal();
  };


  render() {
    const { confirmLoading, ModalText, fields } = this.state;
    const WalletButton = this.props.walletButton;
    const { getFieldDecorator, setFieldsValue } = this.props.form;
    return (
      <div>
        <Modal
          title={"Transaction for Jack's Pot"}
          visible={this.props.visible}
          onOk={this.handleOk}
          confirmLoading={confirmLoading}
          onCancel={this.handleCancel}
        >
          <Form layout={'vertical'}>
            <Form.Item label="From Address:">
              <WalletButton />
            </Form.Item>
            <Form.Item label="Information:">
              <Input
                style={{textAlign:'center'}}
                readOnly
                prefix={<Icon type="dollar" style={{ color: 'white' }} />}
                // suffix="WAN"
                defaultValue={"Raffle Number Count: 1, Total Price: 10 WAN"}
              />
            </Form.Item>
          </Form>
          <div style={{ color: '#880' }}>* We will use the lowest gas charge by default, around 0.002~0.03 WAN.</div>
        </Modal>
      </div>
    );
  }
}

const SendModal = Form.create({ name: 'normal_login' })(SendModalForm);

export default SendModal;

// export default connect(state => ({
//   selectedAccount: getSelectedAccount(state)
// }))(Panel);


