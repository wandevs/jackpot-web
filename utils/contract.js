
import { mainnetSCAddr, testnetSCAddr, networkId, nodeUrl } from '../conf/config.js';
import lotteryAbi from "../pages/abi/lottery";
import Web3 from 'web3';

let web3 = new Web3();
web3.setProvider(new Web3.providers.HttpProvider(nodeUrl));
const lotterySCAddr = networkId == 1 ? mainnetSCAddr : testnetSCAddr;
let lotterySC = new web3.eth.Contract(lotteryAbi, lotterySCAddr);

export { web3, lotterySC, lotterySCAddr };
export default lotterySC;