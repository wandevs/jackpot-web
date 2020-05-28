
import { mainnetSCAddr, testnetSCAddr, networkId, nodeUrl } from '../conf/config.js';
import lotteryAbi from "../pages/abi/lottery";
import Web3 from 'web3';
import { message } from 'antd';

let web3 = new Web3();
if (nodeUrl.indexOf('ws') === 0) {
    web3.setProvider(new Web3.providers.WebsocketProvider(nodeUrl));
} else {
    web3.setProvider(new Web3.providers.HttpProvider(nodeUrl));
}
const lotterySCAddr = networkId == 1 ? mainnetSCAddr : testnetSCAddr;
let lotterySC = new web3.eth.Contract(lotteryAbi, lotterySCAddr);

let lotteryClosed = async () => {
    let status = await lotterySC.methods.closed().call();
    if (status) {
        message.warning('This round is closed, please waiting for the next roud.');
    }
    console.log('Closed:', status);
    return status;
}

export { web3, lotterySC, lotterySCAddr, lotteryClosed };
export default lotterySC;