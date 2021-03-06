
import { mainnetSCAddr, testnetSCAddr, networkId } from '../conf/config.js';
import { getWeb3 } from '../conf/web3switch.js';
import lotteryAbi from "../pages/abi/lottery";
import Web3 from 'web3';
import { message } from 'antd';

let web3 = getWeb3();
const lotterySCAddr = networkId == 1 ? mainnetSCAddr : testnetSCAddr;

let lotterySC = () => {
    web3 = getWeb3();
    let lotterySC = new web3.eth.Contract(lotteryAbi, lotterySCAddr);
    return lotterySC;
}

let lotteryClosed = async () => {
    let status = await lotterySC().methods.closed().call();
    if (status) {
        message.warning('This round is closed, please waiting for the next roud.');
    }
    console.log('Closed:', status);
    return status;
}

export { web3, lotterySC, lotterySCAddr, lotteryClosed };
export default lotterySC;