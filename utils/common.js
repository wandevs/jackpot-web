import { alertAntd } from './utils.js';

let watchTransactionStatus = (txID, web3, callback) => {
    const getTransactionStatus = async () => {
        const tx = await web3.eth.getTransactionReceipt(txID);
        if (!tx) {
            setTimeout(() => getTransactionStatus(txID), 3000);
        } else if (callback) {
            callback(tx.status);
        } else {
            alertAntd('success');
        }
    };
    setTimeout(() => getTransactionStatus(txID), 3000);
};

export { watchTransactionStatus };