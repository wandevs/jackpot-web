import { Table } from 'antd';
import style from './history.css';
import { Component } from '../components/base';

class History extends Component {

  myDrawColumns = [
    {
      title: 'Index',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: "Number",
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: "Multiple",
      dataIndex: 'times',
      key: 'times',
    },
    {
      title: "from",
      dataIndex: "from",
      key: "from",
    },
    {
      title: "Select",
      dataIndex: "select",
      key: "select",
    }
  ]

  pastDrawResults = [
    {
      title: 'Draw',
      dataIndex: 'draw',
      key: 'draw',
    },
    {
      title: 'Jackpot',
      dataIndex: 'jackpot',
      key: 'jackpot',
    },
    {
      title: 'Prize',
      dataIndex: 'prize',
      key: 'prize',
    },
  ]

  render() {
    return (
      <div className={style.normal}>
        <div style={{ height: "50px" }}></div>
        <div className={style.title5}>
            My Draw History
          </div>
        <div style={{ height: "20px" }}></div>
        <div className={style.table}>
          <Table columns={this.myDrawColumns}/>
          <div className={[style['guess-button'], style.yellowButton].join(' ')}>Withdraw</div>
        <div style={{ height: "20px" }}></div>

        </div>
        <div style={{ height: "30px" }}></div>
        <div className={style.title5}>
            Past Draw Results
          </div>
        <div style={{ height: "20px" }}></div>
        <div className={style.table}>
          <Table columns={this.pastDrawResults} />
        </div>
        <div style={{ height: "50px" }}></div>
        <div style={{ height: "50px" }}></div>
      </div>
    );
  }
}

export default History;