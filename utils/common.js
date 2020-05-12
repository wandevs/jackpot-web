import { getTransactionReceipt } from "wan-dex-sdk-wallet";
import { alertAntd } from './utils.js';

let watchTransactionStatus = (txID, callback) => {
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

export { watchTransactionStatus };